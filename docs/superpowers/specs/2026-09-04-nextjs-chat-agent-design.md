# Next.js chat-agent product — design spec

Status: approved direction, ready to plan. Date: 2026-09-04.

Read alongside:
- `DESIGN_SYSTEM.md` — "The Iris" design language (tokens, radii, shadows, motion, copy, a11y).
- `design/CHAT_VOICE_MODES.md` — the approved chat/voice UX spec. **Authoritative for behaviour.** This doc covers the *engineering* build; where behaviour is concerned, `CHAT_VOICE_MODES.md` wins.
- `design/preview.html` — the 390px mobile mockup embodying the tokens.
- `backend/app/static/index.html` — the working prototype. Source of the functions to port (see the reuse map in `CHAT_VOICE_MODES.md` §9). Stays in the repo as reference; it is **not** the product.

---

## 1. Context & goal

"My Longevity Hub / The Nutty Professor" is a health/longevity chat agent (a friendly professor persona) that answers wellness questions and funnels users toward peptide/supplement brands. Today it is a single static `index.html` served by a FastAPI backend.

**Goal:** build the real product as a **Next.js 16 application** on the natura stack, implementing "The Iris" design system and full parity with what the prototype does — text chat, streaming, markdown, welcome/chips, link cards, guides, read-aloud (TTS), dictation (STT), and the live voice-call mode with the orb. This is past prototyping: it is the shippable frontend.

The **FastAPI backend needs no changes.** It remains the brain (Vertex/Gemini, guardrails, catalogue) and owns `/chat`, `/chat/stream`, `/tts`, `/stt`, the `/live` WebSocket, and `/guides/{slug}` (the latter superseded by native Next.js guides — see §10).

## 2. Decisions (locked)

1. **Architecture:** Next.js frontend + **BFF proxy** to the existing FastAPI backend. Keep the Python brain and voice pipeline; Next.js is UI + proxy.
2. **Scope:** **full parity** with the current app, including dictation and the live WebSocket voice call.
3. **Guides:** **reimplemented natively** in Next.js with the Iris design (content migrated), as real SSR/SEO routes.
4. **Theme toggle:** the light/dark toggle is kept, placed in the **drawer (mobile) / rail footer (desktop)** next to Read-aloud (the header is reserved per `CHAT_VOICE_MODES.md` §2.1). Light is the default.

## 3. Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 strict · Tailwind CSS v4 (`@theme` token model via `@tailwindcss/postcss`) · `motion` v13 · `clsx` + `tailwind-merge` · `next/image` · `zod` v4 · Vitest 4 + `@testing-library/react` (node env). **No Stripe / no commerce SDK.** Scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test`, `test:run`.

## 4. Repo layout

A new `frontend/` beside `backend/` in this repo. Backend untouched.

```
chat-agent/
  backend/                     # FastAPI — unchanged
  frontend/                    # NEW — Next.js 16
    app/
      layout.tsx               # root: fonts, no-flash theme init, <html data-theme>
      globals.css              # Tailwind v4 @theme with the Iris tokens
      page.tsx                 # chat mode shell (client)
      guides/
        page.tsx               # guides index (server)
        [slug]/page.tsx        # Iris article (server, generateStaticParams)
      api/
        chat/stream/route.ts   # BFF: pipe FastAPI /chat/stream (Node runtime)
        tts/route.ts           # BFF: POST {text} -> audio bytes
        stt/route.ts           # BFF: POST raw PCM -> {text}
    components/                 # see §6
    lib/                        # framework-agnostic TS; see §6
    content/guides/             # migrated article content (typed TS) + slug->title catalog
    __tests__/ or *.test.ts(x)  # Vitest
    Dockerfile                 # Cloud Run
```

## 5. BFF & the WebSocket

**HTTP request/response API → Next.js Route Handlers (Node runtime):**
- `POST /api/chat/stream` — forwards body to `${BACKEND_URL}/chat/stream`, returns the upstream `ReadableStream` unbuffered (`text/plain; charset=utf-8`), propagating the `X-Session-Id` response header and mapping upstream 429/413/502 through. Validates the request body with zod before forwarding.
- `POST /api/tts` — proxies `{text}` to `/tts`, returns audio bytes with the upstream media type; non-200 tells the client to fall back to the browser voice.
- `POST /api/stt` — proxies the raw PCM body to `/stt`, returns `{text}`.
- `BACKEND_URL` is **server-only** (default `http://localhost:8000`); the backend origin is never exposed to the browser.

**The `/live` WebSocket** cannot be proxied through Route Handlers, so the browser opens it directly. URL resolved from `NEXT_PUBLIC_LIVE_WS_URL`, **defaulting to same-origin `wss://<host>/live`**. In production a single-domain routing rule (Cloud Run / reverse proxy) routes `/live` to FastAPI and everything else to Next.js, keeping it effectively same-origin; in dev it points at `ws://localhost:8000/live`. Alternative considered and rejected for now: a custom Node server proxying WS (more ops complexity, Cloud-Run-only).

**Env:**
- `BACKEND_URL` (server-only) — FastAPI origin for the BFF.
- `NEXT_PUBLIC_LIVE_WS_URL` (client) — WS origin for `/live`; empty ⇒ same-origin.

## 6. Modules & components

**`lib/` — framework-agnostic TypeScript** (ported from `index.html`, then wrapped by hooks; the reuse map in `CHAT_VOICE_MODES.md` §9 lists the source functions):
- `mic.ts` — AudioContext + `getUserMedia`, 16 kHz mono PCM downsample, RMS `level`, `sink` callback, `micOpen`/`micClose`.
- `liveSocket.ts` — WS connect/close; send `{type:"start"}` / PCM frames / `{type:"end"}`; parse + **zod-validate** inbound messages (`ready`,`card`,`interrupted`,`turn`,`guardrail`,`info`,`error`); play inbound 24 kHz PCM; `flushLive` (barge-in). Emits typed events.
- `voiceMachine.ts` — **pure reducer** for the turn state machine (§7). No I/O. Plus a selector mapping `phase` → `{orbState, statusKey, buttonLabel, buttonStyle}`.
- `autoEnd.ts` — latched-turn VAD controller: speech detected at `level ≥ SPEECH_LEVEL` (0.015, tunable) for a cumulative 300 ms; then 1200 ms continuous silence ⇒ end; 8 s no-speech ⇒ end ("Didn't catch that…"); 30 s hard cap. Pure — driven by level samples + an injected clock.
- `markdown.ts` — the safe renderer ported to typed TS: `esc()` first (full escape), then bold, `*Strong|Moderate|Promising|Animal-only*` → tier badge, inline code, `[label](https url)` links, brand autolink for the four brand domains, and `[[guide:slug]]` extraction → guide cards. Output is a sanitized HTML string (all input pre-escaped; only known tags injected). Also `stripDisclaimer`, `stripGuideTokens`.
- `tts.ts` — `splitHead` (opener + tail), head+tail parallel fetch to `/api/tts`, ordered playback with a `speakSeq` guard, browser `speechSynthesis` fallback, `stopSpeaking`.
- `theme.ts` — get/set `np-theme`, apply `data-theme`, the no-flash init snippet for `layout.tsx`.
- `storage.ts` — typed localStorage helpers (history, session, readaloud, receipts) with try/catch.
- `api.ts` — client fetchers: `streamChat()`, `stt()`, `tts()` hitting `/api/*`.
- `schemas.ts` — zod: `Turn`, `ChatRequest`, the WS inbound message union, guide catalog.

**Hooks — the only React-aware layer:**
- `useTheme()` — light/dark toggle, persisted; default light.
- `useChat()` — `history[]`, `send(text)` with incremental stream reveal, guide-card extraction, persistence, `newChat()`.
- `useReadAloud()` — toggle (off by default), speaks completed replies.
- `useDictation()` — mic → `/api/stt` → textarea; never opens the stage; stops before a call starts.
- `useVoiceCall()` — wires `mic` + `liveSocket` + `voiceMachine` + `autoEnd` + `history.pushState`/Back + `wakeLock` + the tap/hold/latch + Space gesture; exposes the stage view-model and `startCall`/`endCall`.

**Components:**

Chat mode:
```
ChatShell (client)  — orchestrates hooks/context; renders Drawer(≤md) or Rail(lg) via CSS breakpoints
├─ Header           menu(≤md) · 3-slash mark · wordmark · New chat
├─ Drawer / Rail    New chat · Call the professor(waveform) · history(by day) ·
│                   footer: ReadAloudSwitch · ThemeToggle · Guides link
├─ Disclaimer
├─ Thread
│  ├─ Welcome       Orb + gradient greeting (one .kw word) + chips
│  ├─ Message       bot/user; markdown body; LinkCard; tier badge; TypingDots
│  └─ CallReceipt   "─ Voice call · N min ─" divider + any cards
└─ Composer         autosize textarea · MicButton(dictation) · KeyButton(waveform↔arrow, morphs on input)
```
Voice mode:
```
VoiceStage (client, portal · position:fixed inset:0 · role=dialog aria-modal · focus-trap · inert bg · z=50)
   timer(mm:ss tabular) · X · Disclaimer · Orb · status(aria-live=polite) · cards region(LinkCard / voice-note) ·
   TalkButton(64px) · hint(aria-live) · Type-instead link
```
`Orb` is one shared component used both as the hero (empty state) and the stage orb; state via prop. Entering the call from the empty state does a shared-element grow of the same orb (`motion`), from a conversation a slide-up; reduced-motion ⇒ opacity crossfade.

## 7. Voice-call state machine

Pure reducer: `state = { phase, latched, ... }`; events map to transitions. Side effects live in `useVoiceCall`, fired on transitions.

Phases and their view-model (full copy table in `CHAT_VOICE_MODES.md` §6.1 / §7):

| phase | orb | status | button label | style |
|---|---|---|---|---|
| connecting | breathe | "Connecting…" | "Tap to talk" | disabled |
| idle | breathe | "Tap to talk" / desktop "Click or hold Space" | "Tap to talk" | rest |
| listening | `.listening` + `--lvl` | "Listening…" | "Tap when done" / hold "Listening…" | iris fill, pulse, level bar |
| thinking | `.thinking` | "Thinking…" | "Tap to talk" | rest |
| speaking | `.speaking` | "Speaking…" | "Tap to interrupt" | rest |
| dropped | breathe desaturated | "Call dropped. Tap to reconnect." | "Reconnect" | rest |
| reconnecting | breathe desaturated | "Reconnecting…" | "Reconnect" | disabled |
| ended (limit) | static | "Call ended (time limit)…" | hidden | — |
| error | static | error text | hidden | — |
| guardrail | static | "Please read the screen" | "Tap to talk" | rest |

Events: `READY PRESS RELEASE TAP HOLD TURN AUDIO BARGE_IN SOCKET_CLOSED RECONNECT TIME_LIMIT ERROR GUARDRAIL SPEECH_TIMEOUT`.

Gesture (all paths emit the same socket messages — no new protocol): pointerdown ordered checks — dropped ⇒ reconnect; latched ⇒ end + consume; speaking ⇒ barge-in (`flushLive`) then start; else start + record `t0`. pointerup — `<250 ms` ⇒ tap (stay listening, `latched=true`); else hold ⇒ end. Space (desktop) ⇒ hold semantics, never latches, guarded by `e.repeat` and text-field focus. Haptic `navigator.vibrate?.(8)` on start/end (no-op where unsupported). Auto-end (§ `autoEnd.ts`) runs only while latched; timers cleared on manual end, barge-in, socket close, `visibilitychange`→hidden, window blur.

## 8. Data flow

- **Chat send:** Composer → `useChat.send` → `POST /api/chat/stream` `{message, session_id, history}` → Route Handler pipes FastAPI stream back (+`X-Session-Id`) → incremental reveal (timer-based, backgrounded-tab safe, as in the prototype) → on done: render markdown, append guide cards, push to `history[]`, persist; if Read-aloud on → `tts.speak`.
- **Dictation:** MicButton → `mic` PCM → `POST /api/stt` → append text to textarea (placeholder "Working out what you said…").
- **Read-aloud:** completed reply → `tts.speak` (head+tail to `/api/tts`, browser fallback on failure/blocked).
- **Voice call:** KeyButton(empty)/rail row → `startCall` (in the user gesture: create/resume AudioContext + `getUserMedia`; `history.pushState({voice:true})`; wakeLock; open WS) → machine drives the stage; turn gesture sends `start`/PCM/`end`; inbound audio → play + `speaking`; `card` → stage cards; `guardrail` → voice-note + speak safety line; `endCall` (X / Esc / Back / Type-instead / time-limit) → close socket, `micClose`, release wakeLock, `history.back()` only if we pushed and the exit wasn't a `popstate`, restore chat, write a **CallReceipt** into the thread. Modes never share context; entering one tears down the other.

## 9. Persistence (localStorage)

`np-history` (transcript, last 40), `np-session` (existing). New: `np-theme` (`light`/`dark`), `np-readaloud` (bool), `np-receipts` (call receipts keyed by thread position; current-session-only fallback acceptable). All reads/writes wrapped in try/catch; the app renders correctly with none present.

## 10. Guides

Content migrated from `backend/app/static/guides/*.html` into `content/guides/` as **typed TS content modules** (structured sections — headings, prose, lists, callouts, brand CTAs — as data, matching the natura "content layer as source of truth" pattern) + a `slug → {title, subtitle}` catalog matching the `GUIDES` map and the guide link cards. `app/guides/[slug]/page.tsx` is a **server component** with `generateStaticParams` and per-page SEO metadata, rendered through one Iris article template (prose, headings, callouts, brand CTAs). Chat link cards link to `/guides/<slug>`. The FastAPI `/guides` route is left in place but unused by the product.

## 11. Error handling

- Chat: 429 → "You're sending messages a little fast…"; 413 → "That message is a bit long…"; other/failed → the professor apologises in a bot bubble (never a toast). Errors speak as the professor (DESIGN_SYSTEM.md, States).
- TTS: any non-200 or blocked autoplay → silent fallback to the browser voice; a TTS hiccup never breaks a reply.
- STT: failure → textarea placeholder restored, no text appended, no error surfaced beyond that.
- Voice call: mic denied → stage stays open in `error` with `micMsg()` + X + Type-instead; socket drop → `dropped` (tap to reconnect); rate-limit/time-limit copy per §7. No red anywhere except the mic-denied text stays neutral too.

## 12. Accessibility & browser behaviour

Targets ≥ 44px; talk button 64px. Voice stage is a modal dialog (focus trapped, `Escape` closes, background `inert`, focus returns to the composer key on close; on touch do **not** focus the textarea). `#orbStatus` and the hint are `aria-live="polite"`; level changes are not announced. Space-to-talk only when focus is not in a text field. `prefers-reduced-motion` ⇒ static orb, no pulse/slide; state still carried by colour + word + level bar. Colour is never the only signal. Works with the browser Back button and survives tab switches (hidden tab ends the turn, keeps the call; wakeLock re-requested on return). HTTPS only for the mic; on `http://` show the mic-blocked message. Dark mode via the same tokens.

## 13. Testing plan (Vitest 4 + Testing Library, node env)

- **Pure units:** `voiceMachine` (every transition in §7), `autoEnd` (fake timers — speech/silence/no-speech/cap), `markdown` (bold, tier, code, link, brand autolink, guide token, escaping/XSS), `splitHead`, `storage`, zod schemas.
- **BFF handlers:** mocked `fetch` — stream passthrough + `X-Session-Id`, tts/stt proxy, error mapping (429/413/502), request-body validation.
- **Components:** Composer key morph (empty↔text → glyph + `aria-label`), Message markdown output, Welcome, VoiceStage per-phase (status/label/orb), TalkButton tap-vs-hold-vs-latch (pointer events + fake timers), ThemeToggle, ReadAloudSwitch; a11y assertions (dialog role/`aria-modal`, `aria-live`, focus trap basics).
- Real WebAudio/WS remain manual/integration; their message parsing (zod) and orchestration (machine) are covered by units.

## 14. Deployment

Docker → Google Cloud Run (matching imnatura). Single public domain with routing: `/live` (WS) → FastAPI; everything else → Next.js. `BACKEND_URL` set to the internal FastAPI origin; `NEXT_PUBLIC_LIVE_WS_URL` empty (same-origin) in prod, `ws://localhost:8000/live` in dev.

## 15. Out of scope (deliberately)

Passing chat history into the call or the call transcript into chat (modes stay separate) · a `/#talk` deep link · hands-free/server-side VAD · per-message speaker buttons, voice selection, call history · swipe-to-dismiss on the stage · any backend change · a real user-account/auth system (history stays client-side as today).

## 16. Acceptance criteria

Behavioural acceptance is `CHAT_VOICE_MODES.md` §11 (header, morphing key, read-aloud placement, mic-once entry, tap/hold/latch, auto-end, Space, all exits, call receipt, rail at ≥1024px, reduced-motion + keyboard). Engineering acceptance additionally:
- [ ] `frontend/` Next.js app builds (`build`), typechecks (`tsc --noEmit`), lints, and `test:run` passes.
- [ ] BFF streams chat with no buffering and preserves `X-Session-Id`; backend origin absent from client bundle.
- [ ] Full parity with the prototype verified in a real browser (chat, dictation, read-aloud, live call) at mobile and `lg`.
- [ ] Guides render as native Iris routes with SEO metadata; chat cards deep-link to them.
- [ ] Light/dark toggle in drawer/rail, default light, persisted, no flash on load.

## 17. Open items / risks

- **WS single-origin routing** must be configured at deploy (Cloud Run/reverse proxy) for same-origin `/live`; until then dev uses `NEXT_PUBLIC_LIVE_WS_URL`.
- **Guide content migration** is the largest content task; template first, then port the ~7 articles faithfully.
- **iOS Safari audio**: AudioContext/`getUserMedia` must be created inside the entry gesture; verify on a real device.
- **Markdown renderer**: porting the custom renderer preserves the tier/brand/guide-token behaviour; XSS covered by pre-escaping + an allowlist of injected tags (add a sanitiser pass if the renderer grows).
