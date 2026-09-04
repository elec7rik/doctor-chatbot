# Chat mode & Voice mode — UX spec

Status: approved direction, ready to build. Date: 2026-09-04.

Read alongside `DESIGN_SYSTEM.md` (tokens, radii, motion, copy rules) and
`design/preview.html` (the 390px mobile mockup this extends). The existing
working implementation is `backend/app/static/index.html`; section 9 lists what
to reuse from it. The backend needs **no changes** for this spec.

This is a **website**, not a native app: everything below must work in mobile
Safari / Chrome and desktop browsers, with the browser's own back button,
permission prompts, tab switching and window resizing.

---

## 1. The two modes

There are exactly two modes. They are **separate products that share a shell**.

| | Chat mode | Voice mode ("a call") |
|---|---|---|
| What it is | Text thread + composer | A live spoken call with the professor |
| Backend | `POST /chat` (streamed text) | `WebSocket /live` (native audio) |
| Context | Client-side `history[]` | Its own session, **nothing shared** |
| Screen | Header + scrolling thread + sticky composer | Full-window stage: orb, status, cards, talk button |
| Ends when | Never (persists in `localStorage`) | User ends it, time limit, or drop |

Rules that follow from "no shared context":

- The thread is **never** sent to the call. The call's transcript is **never**
  written into the thread. Do not build any bridge that implies memory.
- Entry copy says **"Call the professor"** / **"Talk"**, never "switch to
  voice" or "continue by voice".
- Link cards the professor drops during a call live on the voice stage. When
  the call ends they are **not** appended to the thread as bot messages
  (current behaviour, to be removed). Instead, see §6.4 "Call ended" summary,
  which is a UI receipt, not conversation content.
- A call is never running while the user is in chat mode, and vice versa.
  Entering one tears the other down (socket closed, mic released, TTS stopped).

Two small voice *features* stay inside chat mode and are **not** voice mode:

- **Dictation mic** in the composer: speech → text into the box (`POST /stt`).
- **Read aloud**: a setting that speaks bot replies (`POST /tts`).

---

## 2. Header & composer changes (chat mode)

### 2.1 Header (mobile, base breakpoint)

Left → right: hamburger · 3-slash mark · wordmark · **New chat** icon button.

- Remove both header toggles from the mockup (speaker, waveform). Two identical
  circles for a *setting* and a *mode* is the thing this spec fixes.
- New chat is required on mobile and must not be rail-only
  (DESIGN_SYSTEM.md, Sidebar rule), so it takes the right slot: 44px circle,
  pencil-square glyph, `aria-label="New chat"`.
- Disclaimer strip beneath, unchanged.

### 2.2 Composer: the morphing key

The composer's right-hand key is one button with two faces:

| Textarea | Key shows | Action | `aria-label` |
|---|---|---|---|
| Empty | Waveform glyph, `--iris-600` fill, white | Enter voice mode | "Call the professor" |
| Has text | Arrow-up glyph, `--iris-600` fill, white | Send | "Send" |

- Morph on `input` events; 120ms crossfade of the glyph (`--dur-fast`), no
  layout shift, the pill keeps one size.
- The **dictation mic** stays as the second pill to the left of the key,
  neutral style, mic glyph. It must read as a different verb: mic = "type for
  me", waveform = "talk to him".
- Hover title on desktop: "Call the professor" / "Send".

### 2.3 Read aloud moves out of the header

- Mobile: a switch row in the drawer, "Read answers aloud".
- Desktop: the same switch in the rail footer.
- Behaviour unchanged (`speak()` on completed replies; off by default).
- No per-message speaker button in this pass.

---

## 3. Chat mode layout

### 3.1 Mobile (base → `md`)

Exactly `design/preview.html` with §2 applied. Sticky header, single centred
column, sticky composer with `padding-bottom: max(18px, env(safe-area-inset-bottom))`.

### 3.2 Laptop (`lg` ≥ 1024px)

```
┌──────────────┬──────────────────────────────────────────────┐
│ RAIL 280px   │  disclaimer strip (spans the column)         │
│              │                                              │
│ mark + word  │        ┌──── chat column, max 768px ────┐    │
│ [ New chat ] │        │                                │    │
│ [ Call prof ]│        │  thread / empty state          │    │
│              │        │                                │    │
│ History      │        │                                │    │
│  Today       │        │                                │    │
│   · …        │        │                                │    │
│  Yesterday   │        │                                │    │
│              │        └────────────────────────────────┘    │
│ ─────────    │        ┌──── composer (sticky) ─────────┐    │
│ ◯ Read aloud │        │ [ Ask the professor… ] (mic)(●)│    │
│ Guides       │        └────────────────────────────────┘    │
└──────────────┴──────────────────────────────────────────────┘
```

- Rail: `--surface`, right edge `--shadow-md`, persistent, hamburger hidden.
  Contents top → bottom: lockup; **New chat** (primary row); **Call the
  professor** (secondary row, waveform glyph, same handler as the composer
  key); history grouped by day; footer with the Read-aloud switch and a
  Guides link.
- Chat column: `max-width: 48rem`, centred in the remaining width. It does not
  stretch. The composer is sticky at the column's bottom, same anatomy as
  mobile, so the morphing key is the primary voice entry on desktop too. The
  rail row is a convenience, never the only entry.
- Top bar: at `lg` the wordmark is in the rail, so the top bar is just the
  disclaimer strip. Keep it sticky.
- Keyboard: `Enter` sends, `Shift+Enter` newline, `Escape` blurs the textarea.
  No other shortcuts in chat mode.
- Resizing across `lg` must not lose state: drawer open state is dropped, the
  thread and composer content persist.

---

## 4. Entering and leaving voice mode

### 4.1 Entry sequence

1. User activates the composer key (or the rail row). This is the user gesture
   the browser needs: **create/resume the `AudioContext` and call
   `getUserMedia` inside this handler** (iOS Safari requirement).
2. `history.pushState({ voice: true }, "")` so the browser **Back** button
   exits the call instead of leaving the site.
3. Stop any read-aloud playback. Blur the textarea.
4. Show the voice stage (§5) in state **connecting** ("Getting the microphone
   ready…" → "Connecting…").
5. Request a screen wake lock: `navigator.wakeLock?.request("screen")`.
   Re-request on `visibilitychange` → visible. Ignore failures.
6. Open `WebSocket /live`. On `{type:"ready"}` → state **idle**, status
   "Tap to talk" (mobile) / "Click or hold Space" (desktop).
7. If the mic is denied → stage stays open in state **error** with the mic
   message from `micMsg()`, plus the X and "Type instead" so the user can
   leave. Do not bounce back to chat automatically.

### 4.2 Transition

- From the **empty state**: shared-element grow. The hero orb scales/translates
  into the stage orb position over `--dur-slow` (320ms, `--ease-out`); the
  stage background fades in beneath. Same DOM node is ideal (move it), a
  cross-fade of two identical orbs is acceptable.
- From a **conversation** (hero orb not on screen): the stage slides up from
  the composer edge, 320ms, like a sheet.
- `prefers-reduced-motion`: 150ms opacity crossfade, no movement.

### 4.3 Exits (all lead to the same `endCall()`)

| Trigger | Where |
|---|---|
| X button | Stage top-right |
| "Type instead" link | Under the talk button |
| `Escape` | Desktop keyboard |
| Browser Back / `popstate` | Any |
| Call time limit | Server `{type:"info", text:"call-time-limit"}` |

`endCall()`: send nothing further, close the socket, `micClose()`, release the
wake lock, `history.back()` **only if** we pushed and the exit wasn't itself a
`popstate`, restore the chat view, show the "Call ended" receipt (§6.4).

Focus on exit: on devices with hover, focus the textarea. On touch devices
**do not** focus it (the keyboard would pop up). Move focus to the composer
key instead.

Swipe-to-dismiss is **not required** (website). If added later it must call
the same `endCall()`.

---

## 5. Voice stage layout

`position: fixed; inset: 0; z-index: var(--z-voice)` (50). Background
`radial-gradient(120% 80% at 50% 32%, var(--iris-50), var(--bg) 62%)`.
`role="dialog" aria-modal="true" aria-label="Call with the professor"`; trap
focus inside; `inert` the chat shell beneath.

### 5.1 Mobile (base)

```
┌──────────────────────────────────────┐
│ 02:14                            (X) │  ← 56px bar: timer ink-3 tabular · X 44px
│ ── general information only … 999 ── │  ← disclaimer strip (kept, never spoken)
│                                      │
│                                      │
│              ╭────────╮              │
│              │  ORB   │              │  ← clamp(150px, 46vw, 210px)
│              ╰────────╯              │
│              Listening…              │  ← 16px 600 ink-2, aria-live=polite
│                                      │
│  ┌──────────────────────────────┐    │
│  │ 🔗 Peptides 101 · Tap to open│    │  ← cards / guardrail note, max-w 420
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  ●  Tap when done            │    │  ← talk button 64px, radius-xl
│  └──────────────────────────────┘    │
│      Tap again or just stop talking  │  ← hint 13.5px ink-2
│             Type instead             │  ← ghost link
│           (safe-area inset)          │
└──────────────────────────────────────┘
```

- Column is `flex; column; align-items:center`, content `max-width: 480px`.
- Orb, status and cards sit in the flexible middle; the talk block is pinned
  at the bottom with `padding-bottom: max(18px, env(safe-area-inset-bottom))`.
- Cards stack newest-last, up to three visible; beyond that the middle region
  scrolls. Cards are the existing `.linkcard`; the guardrail note is the
  existing `.voice-note`.
- Timer: `mm:ss`, `font-variant-numeric: tabular-nums`, starts on **ready**.

### 5.2 Laptop (`lg`+)

Same overlay, full window, covering the rail. A call takes over the screen; a
rail of past conversations is not useful mid-call and would tempt context
mixing the modes don't have.

- Inner column `max-width: 560px`, vertically centred.
- Orb 240px. Status 17px.
- Talk button `max-width: 420px`, centred. Hint reads "Click to talk, or hold
  Space".
- X stays top-right of the **window**; timer top-left. `Escape` closes.
- No hover-only affordances: everything the mouse can do, the keyboard can do
  (Space for talking, Tab to the button/X/Type-instead).

---

## 6. The talk control and turn state machine

One button, `#hold`, 64px, `--radius-xl`, `--surface`/`--line` at rest. Hybrid
gesture so phones don't require a pinned thumb, while desktop keeps
walkie-talkie feel.

### 6.1 States

```
connecting ──ready──▶ idle ──press──▶ listening ──end──▶ thinking ──audio──▶ speaking
   ▲                    ▲                                            │
   │                    └──────────────── {type:"turn"} ◀────────────┘
   │                    ▲                                            │
   │                    └──── press while speaking = barge-in ───────┘
 dropped ◀── socket closed while call open ──press──▶ reconnecting ──ready──▶ idle
```

| State | Orb | Status word | Button label | Button style |
|---|---|---|---|---|
| connecting | breathe | "Connecting…" | "Tap to talk" | disabled look |
| idle | breathe | "Tap to talk" *(desktop: "Click or hold Space")* | "Tap to talk" | rest |
| listening | `.listening` + `--lvl` scale | "Listening…" | "Tap when done" *(hold: "Listening…")* | `--iris-600` fill, white, `hold-pulse`, level bar |
| thinking | `.thinking` | "Thinking…" | "Tap to talk" | rest |
| speaking | `.speaking` | "Speaking…" | "Tap to interrupt" | rest |
| dropped | breathe, desaturated | "Call dropped. Tap to reconnect." | "Reconnect" | rest |
| reconnecting | breathe, desaturated | "Reconnecting…" | "Reconnect" | disabled look |
| ended (limit) | static | "Call ended (time limit)" | hidden | — |
| error | static | error text | hidden | — |
| guardrail | static | "Please read the screen" | "Tap to talk" | rest |

### 6.2 Gesture

All paths send the same two socket messages: `{type:"start"}` then PCM frames,
then `{type:"end"}`. No new protocol.

- **pointerdown** (with pointer capture), checked in this order:
  1. state is **dropped** → `liveConnect()`, nothing else.
  2. `latched` is true → this is the second tap: `holdEnd()`, `latched = false`,
     mark this press as consumed so its pointerup does nothing.
  3. state is **speaking** → barge-in: `flushLive()` then continue to 4
     (this already exists in `holdStart`).
  4. otherwise → `holdStart()` immediately, record `t0`.
- **pointerup** (only for a press that reached step 4):
  - if `now − t0 < 250ms` → this was a **tap**: stay in listening,
    `latched = true`, label "Tap when done".
  - else → this was a **hold**: `holdEnd()`.
- **Space** on desktop: keydown → `holdStart()`, keyup → `holdEnd()`. Never
  latches. Guards as today: `e.repeat`, and ignore when focus is in a text
  field.
- **`contextmenu`**, `touch-action: none`, `user-select: none`,
  `-webkit-touch-callout: none` on the button (already in place).
- Haptic: `navigator.vibrate?.(8)` on start and end. No-op where unsupported
  (iOS); do not gate anything on it.

### 6.3 Auto-end for latched turns

Runs only when `latched` is true (hold turns end on release).

- `mic.level` (RMS, already computed) with a threshold `SPEECH_LEVEL`
  (start at `0.015`, tunable constant at the top of the script).
- **Speech detected** once level ≥ threshold for a cumulative 300ms.
- After speech is detected, **1200ms of continuous** level < threshold → `holdEnd()`.
- **No-speech timeout**: if speech is never detected within 8s → `holdEnd()`,
  status "Didn't catch that. Tap to talk."
- **Hard cap**: 30s per turn → `holdEnd()`.
- Timers are cleared on any manual end, on barge-in, on socket close, on
  `visibilitychange` → hidden and on `window` blur (which end the turn, as
  today).

The hint line under the button, while latched: "Tap again, or just stop
talking." While holding: "Release to answer."

### 6.4 "Call ended" receipt in chat mode

When a call ends, chat mode shows one compact system row in the thread,
visually a divider, not a bubble:

```
───── Voice call · 2 min ─────
[ 🔗 Peptides 101 · Tap to open ]   (only if cards were dropped)
```

- `--ink-3` 12.5px text, hairline rules, cards reuse `.linkcard`.
- This row is **not** pushed into `history[]` and is never sent to `/chat`. It
  is stored separately (e.g. `np-receipts` in `localStorage`) keyed by
  position so it survives reload. If storing it is awkward, showing it only
  for the current page session is acceptable in this pass.
- If the call had no cards and lasted under 5 seconds, show nothing.

---

## 7. Status copy (all states, UK English, professor's tone)

| Situation | Copy |
|---|---|
| Mic being requested | "Getting the microphone ready…" |
| Mic denied | "Microphone access is blocked for this site. Allow it in your browser's settings, then try again." |
| No mic | "No microphone found." |
| Socket connecting | "Connecting…" |
| Ready, mobile | "Tap to talk" |
| Ready, desktop | "Click or hold Space" |
| Listening | "Listening…" |
| Thinking | "Thinking…" |
| Speaking | "Speaking…" |
| Nothing heard | "Didn't catch that. Tap to talk." |
| Dropped | "Call dropped. Tap to reconnect." *(button label "Reconnect")* |
| Rate limited | "Too many requests just now. Give it a few seconds." |
| Time limit | "Call ended (time limit). Start a new call from the chat." |
| Guardrail | "Please read the screen" + the `.voice-note` text |

No red for any of these except the mic-denied message, which stays neutral
text too. Errors speak as the professor (DESIGN_SYSTEM.md, States).

---

## 8. Dictation mic (chat mode, unchanged behaviour)

- Tap → record (`--danger` fill, `record-pulse`), tap → stop, PCM to
  `POST /stt`, result appended to the textarea, placeholder shows "Working out
  what you said…" meanwhile.
- Must never open the voice stage. Must never run while a call is open.
- If the user taps the morphing key while dictating, stop dictation first,
  drop the audio, then enter the call.

---

## 9. Reuse from `backend/app/static/index.html`

Keep these; restyle around them rather than rewriting.

| Piece | Where | Notes |
|---|---|---|
| Orb markup + keyframes | `.orb` / `#orb`, `setOrbState()` | Retarget colours to `--grad-orb-*` tokens from DESIGN_SYSTEM.md |
| Shared mic | `micOpen()`, `micClose()`, `mic.level`, `mic.sink` | 16kHz mono PCM; `mic.level` feeds the auto-end |
| Live socket | `liveConnect()`, `liveDisconnect()`, `playPCM()`, `flushLive()` | Protocol: send `{type:"start"}` / PCM frames / `{type:"end"}`; receive binary 24kHz PCM and `ready`, `card`, `interrupted`, `turn`, `guardrail`, `info`, `error` |
| Hold button + Space handling | `holdStart()`, `holdEnd()`, `setHoldUI()`, `meter()` | Add the tap/latch branch and timers (§6.2–6.3) |
| Cards, guardrail note | `cardEl()`, `showCard()`, `showGuardrail()` | Stop appending cards to the thread as bot messages; route to the receipt (§6.4) |
| Dictation | `#mic` click handler | Unchanged |
| Read aloud | `speak()`, `stopSpeaking()`, `readAloud` | Move the toggle to drawer/rail |
| Mode toggle | `setTalkMode(on)` | Becomes `startCall()` / `endCall()` with the §4 sequence |

Remove: the `#talkMode` and `#readAloud` header buttons, the
`composer.talking` swap (the talk button now lives on the stage, not in the
composer).

---

## 10. Accessibility & browser behaviour checklist

- All targets ≥ 44px. The talk button is 64px tall and full width up to 420px.
- Voice stage is a modal dialog: focus trapped, `Escape` closes, background
  `inert`, focus returns to the composer key on close.
- `#orbStatus` is `aria-live="polite"`; the hint line under the button too.
  Do not announce level changes.
- Space to talk only when focus is **not** in a text field; the stage has none,
  so this is only a guard for chat mode.
- `prefers-reduced-motion`: orb static gradient, no pulse, no slide; state is
  still communicated by colour, label and the level bar.
- Colour is never the only signal: every state has a word.
- Works with the browser Back button (§4.1 step 2) and survives tab switches:
  hidden tab ends the current turn but keeps the call open; on return the
  wake lock is re-requested.
- HTTPS only for the mic; on `http://` show the mic-blocked message.
- No autoplay assumptions: model audio plays through the `AudioContext`
  created in the entry gesture.
- Dark mode via the same tokens; the stage gradient uses `--iris-50` which
  already has a dark value.

---

## 11. Acceptance

- [ ] Header shows menu · mark · wordmark · New chat only. No speaker/waveform.
- [ ] Composer key is a waveform when empty, an arrow when there is text.
- [ ] Read-aloud switch lives in the drawer (mobile) / rail footer (desktop) and works.
- [ ] Tapping the key on a phone asks for the mic once, then opens the stage with the orb growing from the hero (empty state) or a slide-up (conversation).
- [ ] Tap → listening; second tap → thinking; the reply plays; tap during the reply cuts it off.
- [ ] Hold ≥ 250ms → listening until release.
- [ ] Stop talking for ~1.2s on a latched turn → the turn ends by itself.
- [ ] Space works on desktop and never latches.
- [ ] Browser Back, Escape, X and "Type instead" all end the call and land on the same chat view.
- [ ] After the call, a "Voice call · N min" divider appears in the thread with any cards; `history[]` is untouched.
- [ ] Rail at ≥ 1024px with New chat, Call the professor, history, Read-aloud switch. Stage covers the whole window at that size.
- [ ] Reduced-motion and keyboard-only paths verified.

---

## 12. Out of scope (deliberately)

- Passing chat history into the call, or the call's transcript into chat. The
  modes stay separate.
- A deep link like `/#talk` that opens straight into a call (the mic needs a
  user gesture anyway).
- Hands-free / server-side voice activity detection (cost, weak-link
  robustness; see `live.py` header comment).
- Per-message speaker buttons, voice selection, call history.
- Swipe-to-dismiss on the stage.
