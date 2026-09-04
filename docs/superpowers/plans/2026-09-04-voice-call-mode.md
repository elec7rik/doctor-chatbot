# Voice-Call Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the live voice-call mode — a full-window stage with the Iris orb where the user holds/taps to talk to the professor over the `/live` WebSocket (native audio), sees tappable link/guide cards, and returns to chat with a "Voice call · N min" receipt.

**Architecture:** A pure turn **state machine** (`voiceMachine.ts`) and a pure **auto-end VAD** (`autoEnd.ts`) hold all the decision logic; a thin **WebSocket wrapper** (`liveSocket.ts`) zod-validates inbound frames; the shared **mic** (`mic.ts`) gains 24 kHz PCM output through its own AudioContext; a single orchestration hook (`useVoiceCall.ts`) wires mic + socket + machine + auto-end + wakeLock + Back-button + the tap/hold/latch + Space gesture; a `VoiceStage` portal renders the phase view-model. Modes never share context — entering the call tears down read-aloud; leaving it writes a receipt.

**Tech Stack:** Same as Phases 1–2 — Next.js 16, React 19, TS strict, Tailwind v4, zod v4, Vitest 4 + Testing Library (jsdom).

This is Phase 3 of 4. It implements spec `docs/superpowers/specs/2026-09-04-nextjs-chat-agent-design.md` §6 (`liveSocket.ts`, `voiceMachine.ts`, `autoEnd.ts`, `useVoiceCall`), §7 (state machine), §8 (voice-call data flow), and `design/CHAT_VOICE_MODES.md` §4–§7, §10, §11. Native guides remain Phase 4.

## Global Constraints

- The backend is **unchanged**. The `/live` WebSocket protocol (from `backend/app/live.py`):
  - **Browser → server:** text `{"type":"start"}` (begin speaking), text `{"type":"end"}` (done), and binary 16 kHz 16-bit mono PCM frames in between.
  - **Server → browser:** binary frames = 24 kHz 16-bit mono PCM (model audio); text JSON messages: `ready`, `card {url,title,subtitle,brand}`, `user {text}` (input transcript), `bot {text}` (output transcript), `interrupted`, `turn`, `guardrail {text}`, `info {text}` (e.g. `"call-time-limit"`), `error {text}` (e.g. `"rate_limited"`).
  - Voice mode shows the **orb, not a transcript**: `user`/`bot` messages are received but **ignored** by the UI.
- The `/live` WS is opened **browser-direct** (Route Handlers can't proxy WS). URL from `NEXT_PUBLIC_LIVE_WS_URL`; empty ⇒ same-origin `wss://<host>/live` (`ws://` on `http:`). Never expose `BACKEND_URL` to the client.
- **Modes are separate.** A call is never running in chat and vice-versa; entering the call stops read-aloud, blurs the textarea, and stops any dictation. The thread is never sent to the call; the call transcript is never written to the thread. Cards dropped during a call go to the **receipt**, not the thread.
- **Entry gesture (iOS Safari):** create/resume the `AudioContext` and call `getUserMedia` **inside** the activating handler. Model audio plays through **that same** AudioContext.
- Mic requires **HTTPS or localhost**; denial ⇒ stage stays open in `error` with `sharedMic.errMessage()`, plus X and "Type instead". Never bounce to chat automatically.
- **No red** anywhere except (neutral) mic-denied text. Every state has a word (colour is never the only signal). Respect `prefers-reduced-motion` (static orb, no pulse/slide). Talk button ≥ 64px; all targets ≥ 44px.
- Reuse the prototype logic in `backend/app/static/index.html` (`playPCM`/`flushLive`/`liveConnect`/`holdStart`/`holdEnd`/`meter`/`setTalkMode`) — port it; add the tap/latch + auto-end that the prototype lacks.
- Copy is **UK English, professor's tone**, verbatim from `CHAT_VOICE_MODES.md` §7.

---

### Task 1: Fix & extend `LiveMessageSchema`

The current `frontend/lib/schemas.ts` union is missing the `user`/`bot` transcription messages the backend actually sends and the `brand` field on cards. Correct it.

**Files:**
- Modify: `frontend/lib/schemas.ts`
- Create: `frontend/lib/schemas.test.ts`

**Interfaces:**
- Produces: `LiveMessageSchema` (zod discriminated union) accepting `ready`, `card {url,title,subtitle?,brand?}`, `user {text}`, `bot {text}`, `interrupted`, `turn`, `guardrail {text}`, `info {text}`, `error {text}`; `type LiveMessage`.

- [ ] **Step 1: Write `frontend/lib/schemas.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { LiveMessageSchema } from "./schemas";

describe("LiveMessageSchema", () => {
  it("accepts a card with a brand", () => {
    const r = LiveMessageSchema.safeParse({ type: "card", url: "https://x.co", title: "T", subtitle: "S", brand: "my-peptides" });
    expect(r.success).toBe(true);
  });
  it("accepts user and bot transcription frames", () => {
    expect(LiveMessageSchema.safeParse({ type: "user", text: "hi" }).success).toBe(true);
    expect(LiveMessageSchema.safeParse({ type: "bot", text: "hello" }).success).toBe(true);
  });
  it("accepts info and error", () => {
    expect(LiveMessageSchema.safeParse({ type: "info", text: "call-time-limit" }).success).toBe(true);
    expect(LiveMessageSchema.safeParse({ type: "error", text: "rate_limited" }).success).toBe(true);
  });
  it("rejects an unknown type and a card missing url", () => {
    expect(LiveMessageSchema.safeParse({ type: "nope" }).success).toBe(false);
    expect(LiveMessageSchema.safeParse({ type: "card", title: "T" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/schemas.test.ts`
Expected: FAIL — `user`/`bot` frames rejected by the old union.

- [ ] **Step 3: Replace the `LiveMessageSchema` block in `frontend/lib/schemas.ts`**
```ts
/** Inbound /live text messages (binary frames are 24kHz PCM audio, handled separately). */
export const LiveMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({
    type: z.literal("card"),
    url: z.string(),
    title: z.string(),
    subtitle: z.string().optional(),
    brand: z.string().optional(),
  }),
  z.object({ type: z.literal("user"), text: z.string() }),
  z.object({ type: z.literal("bot"), text: z.string() }),
  z.object({ type: z.literal("interrupted") }),
  z.object({ type: z.literal("turn") }),
  z.object({ type: z.literal("guardrail"), text: z.string() }),
  z.object({ type: z.literal("info"), text: z.string() }),
  z.object({ type: z.literal("error"), text: z.string() }),
]);
export type LiveMessage = z.infer<typeof LiveMessageSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/schemas.ts frontend/lib/schemas.test.ts
git commit -m "feat(frontend): extend live message schema with transcripts and card brand"
```

---

### Task 2: `voiceMachine.ts` — pure turn state machine + view selector

**Files:**
- Create: `frontend/lib/voiceMachine.ts`, `frontend/lib/voiceMachine.test.ts`

**Interfaces:**
- Produces: `type Phase`, `interface VoiceState { phase, latched, note, errorText }`, `type VoiceEvent`, `initialState`, `reduce(state, event): VoiceState`, `view(state, desktop): VoiceView`, `isTap(downTs, upTs): boolean`, `TAP_MS`.
- Consumed by: `useVoiceCall` (Task 6), `VoiceStage`/`TalkButton` (Task 7).

- [ ] **Step 1: Write `frontend/lib/voiceMachine.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { reduce, view, initialState, isTap, type VoiceState } from "./voiceMachine";

const at = (phase: VoiceState["phase"], over: Partial<VoiceState> = {}): VoiceState => ({
  ...initialState, phase, ...over,
});

describe("voiceMachine.reduce", () => {
  it("connecting/reconnecting -> idle on READY", () => {
    expect(reduce(at("connecting"), { type: "READY" }).phase).toBe("idle");
    expect(reduce(at("reconnecting"), { type: "READY" }).phase).toBe("idle");
  });
  it("PRESS from idle starts listening (unlatched)", () => {
    const s = reduce(at("idle"), { type: "PRESS" });
    expect(s).toMatchObject({ phase: "listening", latched: false });
  });
  it("TAP latches a listening turn; second PRESS ends it to thinking", () => {
    const latched = reduce(at("listening"), { type: "TAP" });
    expect(latched).toMatchObject({ phase: "listening", latched: true });
    expect(reduce(latched, { type: "PRESS" })).toMatchObject({ phase: "thinking", latched: false });
  });
  it("HOLD release: listening -> thinking", () => {
    expect(reduce(at("listening"), { type: "HOLD" }).phase).toBe("thinking");
  });
  it("PRESS while speaking barges back to listening", () => {
    expect(reduce(at("speaking"), { type: "PRESS" }).phase).toBe("listening");
  });
  it("AUDIO -> speaking; TURN -> idle", () => {
    expect(reduce(at("thinking"), { type: "AUDIO" }).phase).toBe("speaking");
    expect(reduce(at("speaking"), { type: "TURN" }).phase).toBe("idle");
  });
  it("SPEECH_TIMEOUT marks nospeech and shows on the next idle", () => {
    const t = reduce(at("listening"), { type: "SPEECH_TIMEOUT" });
    expect(t).toMatchObject({ phase: "thinking", note: "nospeech" });
    expect(view(reduce(t, { type: "TURN" }), false).status).toBe("Didn't catch that. Tap to talk.");
  });
  it("SOCKET_CLOSED -> dropped only from an active phase; RECONNECT -> reconnecting", () => {
    expect(reduce(at("speaking"), { type: "SOCKET_CLOSED" }).phase).toBe("dropped");
    expect(reduce(at("ended"), { type: "SOCKET_CLOSED" }).phase).toBe("ended");
    expect(reduce(at("dropped"), { type: "RECONNECT" }).phase).toBe("reconnecting");
  });
  it("TIME_LIMIT -> ended; ERROR -> error with text; GUARDRAIL -> guardrail", () => {
    expect(reduce(at("speaking"), { type: "TIME_LIMIT" }).phase).toBe("ended");
    expect(reduce(at("idle"), { type: "ERROR", text: "rate_limited" })).toMatchObject({ phase: "error", errorText: "rate_limited" });
    expect(reduce(at("speaking"), { type: "GUARDRAIL" }).phase).toBe("guardrail");
  });
});

describe("voiceMachine.view", () => {
  it("idle status differs by device", () => {
    expect(view(at("idle"), false).status).toBe("Tap to talk");
    expect(view(at("idle"), true).status).toBe("Click or hold Space");
  });
  it("listening label depends on latched", () => {
    expect(view(at("listening", { latched: false }), false).buttonLabel).toBe("Listening…");
    expect(view(at("listening", { latched: true }), false).buttonLabel).toBe("Tap when done");
    expect(view(at("listening"), false).showLevel).toBe(true);
  });
  it("speaking button says interrupt; ended/error hide the button", () => {
    expect(view(at("speaking"), false).buttonLabel).toBe("Tap to interrupt");
    expect(view(at("ended"), false).buttonHidden).toBe(true);
    expect(view(at("error", { errorText: "rate_limited" }), false).status).toBe("Too many requests just now. Give it a few seconds.");
  });
  it("dropped/reconnecting desaturate the orb", () => {
    expect(view(at("dropped"), false).desaturated).toBe(true);
    expect(view(at("reconnecting"), false).buttonDisabled).toBe(true);
  });
});

describe("isTap", () => {
  it("under 250ms is a tap, 250ms+ is a hold", () => {
    expect(isTap(1000, 1200)).toBe(true);
    expect(isTap(1000, 1300)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/voiceMachine.test.ts`
Expected: FAIL — cannot find module `./voiceMachine`.

- [ ] **Step 3: Write `frontend/lib/voiceMachine.ts`**
```ts
export type Phase =
  | "connecting" | "idle" | "listening" | "thinking" | "speaking"
  | "dropped" | "reconnecting" | "ended" | "error" | "guardrail";

export interface VoiceState {
  phase: Phase;
  latched: boolean;
  note: "" | "nospeech";
  errorText: string;
}

export type VoiceEvent =
  | { type: "RESET" }
  | { type: "READY" }
  | { type: "PRESS" }
  | { type: "TAP" }
  | { type: "HOLD" }
  | { type: "SPEECH_TIMEOUT" }
  | { type: "AUDIO" }
  | { type: "TURN" }
  | { type: "SOCKET_CLOSED" }
  | { type: "RECONNECT" }
  | { type: "TIME_LIMIT" }
  | { type: "GUARDRAIL" }
  | { type: "ERROR"; text: string };

export const initialState: VoiceState = { phase: "connecting", latched: false, note: "", errorText: "" };

const ACTIVE: Phase[] = ["connecting", "idle", "listening", "thinking", "speaking", "guardrail", "reconnecting"];

export function reduce(s: VoiceState, e: VoiceEvent): VoiceState {
  switch (e.type) {
    case "RESET":
      return { ...initialState };
    case "READY":
      return s.phase === "connecting" || s.phase === "reconnecting" ? { ...s, phase: "idle" } : s;
    case "PRESS":
      if (s.phase === "listening" && s.latched) return { ...s, phase: "thinking", latched: false };
      if (s.phase === "speaking") return { ...s, phase: "listening", latched: false, note: "" };
      if (s.phase === "idle" || s.phase === "thinking" || s.phase === "guardrail")
        return { ...s, phase: "listening", latched: false, note: "" };
      return s;
    case "TAP":
      return s.phase === "listening" ? { ...s, latched: true } : s;
    case "HOLD":
      return s.phase === "listening" ? { ...s, phase: "thinking", latched: false } : s;
    case "SPEECH_TIMEOUT":
      return s.phase === "listening" ? { ...s, phase: "thinking", latched: false, note: "nospeech" } : s;
    case "AUDIO":
      return s.phase === "thinking" || s.phase === "speaking" ? { ...s, phase: "speaking", note: "" } : s;
    case "TURN":
      return s.phase === "thinking" || s.phase === "speaking" ? { ...s, phase: "idle" } : s;
    case "SOCKET_CLOSED":
      return ACTIVE.includes(s.phase) ? { ...s, phase: "dropped", latched: false } : s;
    case "RECONNECT":
      return s.phase === "dropped" ? { ...s, phase: "reconnecting" } : s;
    case "TIME_LIMIT":
      return { ...s, phase: "ended", latched: false };
    case "GUARDRAIL":
      return ACTIVE.includes(s.phase) ? { ...s, phase: "guardrail", latched: false } : s;
    case "ERROR":
      return { ...s, phase: "error", latched: false, errorText: e.text };
    default:
      return s;
  }
}

export interface VoiceView {
  orb: "listening" | "thinking" | "speaking" | undefined;
  breathe: boolean;
  desaturated: boolean;
  frozen: boolean;
  status: string;
  buttonLabel: string;
  buttonHidden: boolean;
  buttonDisabled: boolean;
  buttonActive: boolean;
  showLevel: boolean;
}

function vv(over: Partial<VoiceView>): VoiceView {
  return {
    orb: undefined, breathe: false, desaturated: false, frozen: false,
    status: "", buttonLabel: "Tap to talk", buttonHidden: false,
    buttonDisabled: false, buttonActive: false, showLevel: false, ...over,
  };
}

export function view(s: VoiceState, desktop: boolean): VoiceView {
  const ready = desktop ? "Click or hold Space" : "Tap to talk";
  switch (s.phase) {
    case "connecting":
      return vv({ breathe: true, status: "Connecting…", buttonDisabled: true });
    case "idle":
      return vv({ breathe: true, status: s.note === "nospeech" ? "Didn't catch that. Tap to talk." : ready });
    case "listening":
      return vv({ orb: "listening", status: "Listening…", buttonLabel: s.latched ? "Tap when done" : "Listening…", buttonActive: true, showLevel: true });
    case "thinking":
      return vv({ orb: "thinking", status: "Thinking…" });
    case "speaking":
      return vv({ orb: "speaking", status: "Speaking…", buttonLabel: "Tap to interrupt" });
    case "dropped":
      return vv({ breathe: true, desaturated: true, status: "Call dropped. Tap to reconnect.", buttonLabel: "Reconnect" });
    case "reconnecting":
      return vv({ breathe: true, desaturated: true, status: "Reconnecting…", buttonLabel: "Reconnect", buttonDisabled: true });
    case "ended":
      return vv({ frozen: true, status: "Call ended (time limit). Start a new call from the chat.", buttonHidden: true });
    case "error":
      return vv({ frozen: true, status: s.errorText === "rate_limited" ? "Too many requests just now. Give it a few seconds." : (s.errorText || "Something went wrong."), buttonHidden: true });
    case "guardrail":
      return vv({ frozen: true, status: "Please read the screen" });
  }
}

export const TAP_MS = 250;
export function isTap(downTs: number, upTs: number): boolean {
  return upTs - downTs < TAP_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/voiceMachine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/voiceMachine.ts frontend/lib/voiceMachine.test.ts
git commit -m "feat(frontend): pure voice-call turn state machine and view selector"
```

---

### Task 3: `autoEnd.ts` — latched-turn voice-activity auto-end

**Files:**
- Create: `frontend/lib/autoEnd.ts`, `frontend/lib/autoEnd.test.ts`

**Interfaces:**
- Produces: `createAutoEnd({ onEnd, onNoSpeech }): { sample(level, now): void; reset(): void }` and the tunable constants `SPEECH_LEVEL`, `SPEECH_CONFIRM_MS`, `SILENCE_END_MS`, `NO_SPEECH_MS`, `HARD_CAP_MS`. Pure — `now` is injected per sample (no `Date.now`/timers inside).
- Consumed by: `useVoiceCall` (Task 6), driven only while `latched`.

- [ ] **Step 1: Write `frontend/lib/autoEnd.test.ts`**
```ts
import { describe, it, expect, vi } from "vitest";
import { createAutoEnd } from "./autoEnd";

describe("createAutoEnd", () => {
  it("ends after speech then ~1.2s of silence", () => {
    const onEnd = vi.fn(), onNoSpeech = vi.fn();
    const a = createAutoEnd({ onEnd, onNoSpeech });
    a.sample(0.05, 0); a.sample(0.05, 150); a.sample(0.05, 350); // 300ms cumulative speech -> detected
    a.sample(0.0, 400);   // silence starts
    a.sample(0.0, 1700);  // 1300ms silent -> end
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onNoSpeech).not.toHaveBeenCalled();
  });
  it("fires no-speech if nothing is heard within 8s", () => {
    const onEnd = vi.fn(), onNoSpeech = vi.fn();
    const a = createAutoEnd({ onEnd, onNoSpeech });
    a.sample(0.0, 0); a.sample(0.0, 8000);
    expect(onNoSpeech).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });
  it("brief pauses under 1.2s do not end the turn", () => {
    const onEnd = vi.fn();
    const a = createAutoEnd({ onEnd, onNoSpeech: vi.fn() });
    a.sample(0.05, 0); a.sample(0.05, 350);       // detected
    a.sample(0.0, 400); a.sample(0.05, 900);      // 500ms pause then speech again -> reset
    a.sample(0.0, 1000); a.sample(0.0, 2000);     // 1000ms silent, still short of 1200
    expect(onEnd).not.toHaveBeenCalled();
  });
  it("hard-caps a 30s turn even while speaking", () => {
    const onEnd = vi.fn();
    const a = createAutoEnd({ onEnd, onNoSpeech: vi.fn() });
    a.sample(0.05, 0); a.sample(0.05, 30000);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
  it("reset() clears state so a callback fires at most once per turn", () => {
    const onEnd = vi.fn();
    const a = createAutoEnd({ onEnd, onNoSpeech: vi.fn() });
    a.sample(0.05, 0); a.sample(0.05, 350); a.sample(0.0, 400); a.sample(0.0, 1700);
    a.sample(0.0, 5000); // ignored: already done this turn
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/autoEnd.test.ts`
Expected: FAIL — cannot find module `./autoEnd`.

- [ ] **Step 3: Write `frontend/lib/autoEnd.ts`**
```ts
export const SPEECH_LEVEL = 0.015;
export const SPEECH_CONFIRM_MS = 300;
export const SILENCE_END_MS = 1200;
export const NO_SPEECH_MS = 8000;
export const HARD_CAP_MS = 30000;

export interface AutoEnd {
  sample(level: number, now: number): void;
  reset(): void;
}

export function createAutoEnd(cb: { onEnd: () => void; onNoSpeech: () => void }): AutoEnd {
  let startTs = -1;
  let lastTs = -1;
  let speechAccum = 0;
  let speechDetected = false;
  let silenceStart = -1;
  let done = false;

  function reset(): void {
    startTs = -1; lastTs = -1; speechAccum = 0; speechDetected = false; silenceStart = -1; done = false;
  }

  function sample(level: number, now: number): void {
    if (done) return;
    if (startTs < 0) { startTs = now; lastTs = now; }
    const dt = Math.max(0, now - lastTs);
    lastTs = now;

    if (now - startTs >= HARD_CAP_MS) { done = true; cb.onEnd(); return; }

    if (!speechDetected) {
      if (level >= SPEECH_LEVEL) {
        speechAccum += dt;
        if (speechAccum >= SPEECH_CONFIRM_MS) speechDetected = true;
      }
      if (!speechDetected && now - startTs >= NO_SPEECH_MS) { done = true; cb.onNoSpeech(); return; }
      return;
    }

    if (level < SPEECH_LEVEL) {
      if (silenceStart < 0) silenceStart = now;
      else if (now - silenceStart >= SILENCE_END_MS) { done = true; cb.onEnd(); return; }
    } else {
      silenceStart = -1;
    }
  }

  return { sample, reset };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/autoEnd.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/autoEnd.ts frontend/lib/autoEnd.test.ts
git commit -m "feat(frontend): pure auto-end VAD controller for latched turns"
```

---

### Task 4: `mic.ts` — 24 kHz PCM output through the shared AudioContext

Model audio must play through the **same** AudioContext the mic created in the entry gesture (iOS). Add gapless output + barge-in flush to `SharedMic`, plus a pure converter.

**Files:**
- Modify: `frontend/lib/mic.ts`, `frontend/lib/mic.test.ts`

**Interfaces:**
- Produces (pure, tested): `pcm16ToFloat32(buf: ArrayBuffer): Float32Array`.
- Produces (on `sharedMic`, manually verified — WebAudio): `play24k(buf: ArrayBuffer): void` (schedule a 24 kHz PCM buffer gaplessly via an internal play-head), `flushOutput(): void` (stop all scheduled sources; reset the head — barge-in).

- [ ] **Step 1: Add the converter test** — append to `frontend/lib/mic.test.ts`:
```ts
import { pcm16ToFloat32 } from "./mic";

describe("pcm16ToFloat32", () => {
  it("maps int16 samples to [-1, 1) floats", () => {
    const i16 = new Int16Array([0, 32767, -32768]);
    const f = pcm16ToFloat32(i16.buffer);
    expect(f[0]).toBeCloseTo(0, 5);
    expect(f[1]).toBeCloseTo(0.99997, 4);
    expect(f[2]).toBe(-1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/mic.test.ts`
Expected: FAIL — `pcm16ToFloat32` is not exported.

- [ ] **Step 3: Implement in `frontend/lib/mic.ts`**

Add this exported helper near `downsampleTo16k`:
```ts
/** Convert a 16-bit PCM ArrayBuffer to normalised Float32 samples. */
export function pcm16ToFloat32(buf: ArrayBuffer): Float32Array {
  const i16 = new Int16Array(buf);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i]! / 32768;
  return f32;
}
```

Add these fields to `class SharedMic` (next to `level`, `capturing`, …):
```ts
  private playHead = 0;
  private sources = new Set<AudioBufferSourceNode>();
```

Add these methods to `class SharedMic`:
```ts
  /** Play a 24 kHz mono 16-bit PCM chunk through the shared context, gaplessly. */
  play24k(buf: ArrayBuffer): void {
    const ctx = this.s.ctx;
    if (!ctx) return;
    const f32 = pcm16ToFloat32(buf);
    const ab = ctx.createBuffer(1, f32.length, 24000);
    ab.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = ab;
    src.connect(ctx.destination);
    const t = Math.max(ctx.currentTime, this.playHead);
    src.start(t);
    this.playHead = t + ab.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** Barge-in: stop everything queued and reset the play head. */
  flushOutput(): void {
    for (const s of this.sources) { try { s.stop(); } catch { /* ignore */ } }
    this.sources.clear();
    this.playHead = this.s.ctx ? this.s.ctx.currentTime : 0;
  }
```

In `close()`, also reset output — add before the final field reset:
```ts
    this.flushOutput();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/mic.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/mic.ts frontend/lib/mic.test.ts
git commit -m "feat(frontend): 24kHz PCM output and barge-in flush on the shared mic"
```

---

### Task 5: `liveSocket.ts` — zod-validated `/live` WebSocket wrapper

**Files:**
- Create: `frontend/lib/liveSocket.ts`, `frontend/lib/liveSocket.test.ts`

**Interfaces:**
- Produces: `liveUrl(env: string | undefined, loc: { protocol: string; host: string }): string`; `interface LiveHandlers { onOpen?, onClose?, onAudio?(buf: ArrayBuffer), onMessage?(m: LiveMessage) }`; `interface LiveSocket { readonly readyState: number; send(m: {type:"start"}|{type:"end"}): void; sendPCM(frame: Int16Array): void; close(): void }`; `createLiveSocket(url, handlers, WS?): LiveSocket` (WS constructor injectable for tests). Inbound JSON is `LiveMessageSchema`-validated; invalid frames are dropped; binary frames go to `onAudio`.
- Consumed by: `useVoiceCall` (Task 6).

- [ ] **Step 1: Write `frontend/lib/liveSocket.test.ts`**
```ts
import { describe, it, expect, vi } from "vitest";
import { liveUrl, createLiveSocket } from "./liveSocket";

describe("liveUrl", () => {
  it("prefers the explicit env URL", () => {
    expect(liveUrl("ws://localhost:8000/live", { protocol: "https:", host: "x" })).toBe("ws://localhost:8000/live");
  });
  it("falls back to same-origin wss/ws by page protocol", () => {
    expect(liveUrl(undefined, { protocol: "https:", host: "app.co" })).toBe("wss://app.co/live");
    expect(liveUrl("", { protocol: "http:", host: "localhost:3000" })).toBe("ws://localhost:3000/live");
  });
});

class FakeWS {
  static OPEN = 1;
  url: string;
  binaryType = "";
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  sent: unknown[] = [];
  constructor(url: string) { this.url = url; }
  send(d: unknown) { this.sent.push(d); }
  close() { this.readyState = 3; this.onclose?.(); }
}

function make() {
  const handlers = { onOpen: vi.fn(), onClose: vi.fn(), onAudio: vi.fn(), onMessage: vi.fn() };
  let ws!: FakeWS;
  const WS = vi.fn().mockImplementation((url: string) => (ws = new FakeWS(url))) as unknown as typeof WebSocket;
  const sock = createLiveSocket("ws://x/live", handlers, WS);
  return { sock, handlers, get ws() { return ws; } };
}

describe("createLiveSocket", () => {
  it("routes a valid JSON frame to onMessage and drops invalid ones", () => {
    const t = make();
    t.ws.onmessage!({ data: JSON.stringify({ type: "ready" }) });
    t.ws.onmessage!({ data: JSON.stringify({ type: "bogus" }) });
    t.ws.onmessage!({ data: "not json" });
    expect(t.handlers.onMessage).toHaveBeenCalledTimes(1);
    expect(t.handlers.onMessage).toHaveBeenCalledWith({ type: "ready" });
  });
  it("routes a binary frame to onAudio", () => {
    const t = make();
    const buf = new ArrayBuffer(8);
    t.ws.onmessage!({ data: buf });
    expect(t.handlers.onAudio).toHaveBeenCalledWith(buf);
  });
  it("send() serialises control messages; sendPCM sends the frame buffer", () => {
    const t = make();
    t.sock.send({ type: "start" });
    t.sock.sendPCM(new Int16Array([1, 2, 3]));
    expect(t.ws.sent[0]).toBe(JSON.stringify({ type: "start" }));
    expect(t.ws.sent[1]).toBeInstanceOf(ArrayBuffer);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/liveSocket.test.ts`
Expected: FAIL — cannot find module `./liveSocket`.

- [ ] **Step 3: Write `frontend/lib/liveSocket.ts`**
```ts
import { LiveMessageSchema, type LiveMessage } from "./schemas";

export function liveUrl(env: string | undefined, loc: { protocol: string; host: string }): string {
  if (env) return env;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/live`;
}

export interface LiveHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onAudio?: (buf: ArrayBuffer) => void;
  onMessage?: (m: LiveMessage) => void;
}

export interface LiveSocket {
  readonly readyState: number;
  send(m: { type: "start" } | { type: "end" }): void;
  sendPCM(frame: Int16Array): void;
  close(): void;
}

export function createLiveSocket(url: string, handlers: LiveHandlers, WS: typeof WebSocket = WebSocket): LiveSocket {
  const ws = new WS(url);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => handlers.onOpen?.();
  ws.onclose = () => handlers.onClose?.();
  ws.onerror = () => { /* surfaced via onclose */ };
  ws.onmessage = (ev: MessageEvent) => {
    if (typeof ev.data !== "string") { handlers.onAudio?.(ev.data as ArrayBuffer); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(ev.data); } catch { return; }
    const res = LiveMessageSchema.safeParse(parsed);
    if (res.success) handlers.onMessage?.(res.data);
  };
  return {
    get readyState() { return ws.readyState; },
    send(m) { try { ws.send(JSON.stringify(m)); } catch { /* ignore */ } },
    sendPCM(frame) { try { if (ws.readyState === 1) ws.send(frame.buffer as ArrayBuffer); } catch { /* ignore */ } },
    close() { try { ws.close(); } catch { /* ignore */ } },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/liveSocket.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/liveSocket.ts frontend/lib/liveSocket.test.ts
git commit -m "feat(frontend): zod-validated /live websocket wrapper"
```

---

### Task 6: `useVoiceCall.ts` — orchestration hook

Wires mic + socket + machine + auto-end + wakeLock + Back-button + the tap/hold/latch + Space gesture. WebAudio/WS orchestration is verified manually (spec §13); this task adds one integration-style unit test with the mic and socket mocked.

**Files:**
- Create: `frontend/lib/useVoiceCall.ts`, `frontend/lib/useVoiceCall.test.tsx`
- Modify: `frontend/lib/tts.ts`, `frontend/lib/tts.test.ts` (add exported `browserSpeak` for the guardrail line)

**Interfaces:**
- Consumes: `sharedMic` (Task 4), `createLiveSocket`/`liveUrl` (Task 5), `reduce`/`view`/`isTap`/`initialState` (Task 2), `createAutoEnd` (Task 3), `browserSpeak` (this task), `buildReceipt`/`saveReceipt` (Task 8 — imported; that module lands here first as a stub is **not** needed because Task 8 precedes wiring in ChatShell, but this hook imports them, so **Task 8's storage additions must exist**; to keep tasks independent, this hook imports `buildReceipt`/`saveReceipt`/`type CallCard` from `./storage`, which Task 8 adds — order Task 8's storage step is folded here: see Step 0).
- Produces: `useVoiceCall(opts: { threadLen: number; onBeforeStart?: () => void; onExit?: () => void }): { active, view: VoiceView, elapsed: number, cards: CallCard[], note: string, hint: string, startCall(): Promise<void>, endCall(): void, talkRef: RefObject<HTMLButtonElement | null>, orbRef: RefObject<HTMLDivElement | null>, onPointerDown(e), onPointerUp(e), onPointerCancel() }`.

- [ ] **Step 0: Add receipt storage helpers first (consumed here)** — append to `frontend/lib/storage.ts`:
```ts
export interface CallCard { url: string; title: string; subtitle?: string }
export interface CallReceipt { at: number; mins: number; cards: CallCard[]; ts: number }
const CKEY = "np-receipts";

export function loadReceipts(): CallReceipt[] {
  try {
    const raw = localStorage.getItem(CKEY);
    if (!raw) return [];
    const p: unknown = JSON.parse(raw);
    return Array.isArray(p) ? (p as CallReceipt[]) : [];
  } catch {
    return [];
  }
}
export function saveReceipt(r: CallReceipt): void {
  try {
    const all = loadReceipts();
    all.push(r);
    localStorage.setItem(CKEY, JSON.stringify(all.slice(-20)));
  } catch {
    /* ignore */
  }
}
export function clearReceipts(): void {
  try { localStorage.removeItem(CKEY); } catch { /* ignore */ }
}
/** Null when the call was too short and dropped no cards (spec §6.4). */
export function buildReceipt(atIndex: number, elapsedMs: number, cards: CallCard[]): CallReceipt | null {
  if (elapsedMs < 5000 && cards.length === 0) return null;
  const mins = Math.max(1, Math.round(elapsedMs / 60000));
  return { at: atIndex, mins, cards, ts: Date.now() };
}
```
Also make `clearChat()` clear receipts — add `localStorage.removeItem(CKEY);` inside its existing `try`. Add its tests in Task 8; they are grouped there to keep this task focused on the hook.

- [ ] **Step 1: Add `browserSpeak` to `frontend/lib/tts.ts`** — append:
```ts
/** Speak a line with the browser voice (used for the guardrail safety message on a call). */
export function browserSpeak(text: string): void {
  if (!canBrowserTTS || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const gb = (window.speechSynthesis.getVoices() || []).find((v) => /en-GB/i.test(v.lang));
  if (gb) u.voice = gb;
  window.speechSynthesis.speak(u);
}
```
Append to `frontend/lib/tts.test.ts`:
```ts
import { browserSpeak } from "./tts";

describe("browserSpeak", () => {
  it("no-ops without speechSynthesis and does not throw", () => {
    expect(() => browserSpeak("hi")).not.toThrow();
  });
});
```

- [ ] **Step 2: Write `frontend/lib/useVoiceCall.test.tsx`**
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mic = vi.hoisted(() => ({
  level: 0,
  capturing: false,
  sink: null as ((f: Int16Array) => void) | null,
  open: vi.fn().mockResolvedValue(true),
  close: vi.fn(),
  play24k: vi.fn(),
  flushOutput: vi.fn(),
  errMessage: () => "mic err",
}));
vi.mock("./mic", () => ({ sharedMic: mic }));

const socket = vi.hoisted(() => ({ readyState: 1, send: vi.fn(), sendPCM: vi.fn(), close: vi.fn() }));
const createLiveSocket = vi.hoisted(() => vi.fn());
vi.mock("./liveSocket", () => ({
  createLiveSocket: (url: string, handlers: unknown) => { createLiveSocket(url, handlers); (socket as { handlers?: unknown }).handlers = handlers; return socket; },
  liveUrl: () => "ws://test/live",
}));

import { useVoiceCall } from "./useVoiceCall";
type Handlers = { onOpen?: () => void; onMessage?: (m: unknown) => void; onClose?: () => void };
const handlers = () => (socket as unknown as { handlers: Handlers }).handlers;

beforeEach(() => {
  localStorage.clear();
  mic.open.mockClear(); mic.close.mockClear(); mic.flushOutput.mockClear();
  socket.send.mockClear(); socket.close.mockClear(); createLiveSocket.mockClear();
  window.history.pushState = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("useVoiceCall", () => {
  it("startCall opens the mic and socket; READY moves to idle", async () => {
    const { result } = renderHook(() => useVoiceCall({ threadLen: 0 }));
    await act(async () => { await result.current.startCall(); });
    expect(result.current.active).toBe(true);
    expect(mic.open).toHaveBeenCalled();
    expect(createLiveSocket).toHaveBeenCalled();
    act(() => handlers().onMessage?.({ type: "ready" }));
    expect(result.current.view.status).toBe("Tap to talk");
  });
  it("a card is collected for the receipt, not shown as chat", async () => {
    const { result } = renderHook(() => useVoiceCall({ threadLen: 0 }));
    await act(async () => { await result.current.startCall(); });
    act(() => handlers().onMessage?.({ type: "card", url: "https://x.co", title: "Peptides 101", subtitle: "My Peptides" }));
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0]).toMatchObject({ url: "https://x.co", title: "Peptides 101" });
  });
  it("endCall closes the socket and mic and clears active", async () => {
    const { result } = renderHook(() => useVoiceCall({ threadLen: 0 }));
    await act(async () => { await result.current.startCall(); });
    act(() => handlers().onMessage?.({ type: "ready" }));
    act(() => result.current.endCall());
    expect(socket.close).toHaveBeenCalled();
    expect(mic.close).toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });
  it("a denied mic keeps the stage open in error", async () => {
    mic.open.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useVoiceCall({ threadLen: 0 }));
    await act(async () => { await result.current.startCall(); });
    expect(result.current.active).toBe(true);
    expect(result.current.view.status).toBe("mic err");
    expect(result.current.view.buttonHidden).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/useVoiceCall.test.tsx`
Expected: FAIL — cannot find module `./useVoiceCall`.

- [ ] **Step 4: Write `frontend/lib/useVoiceCall.ts`**
```ts
"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { sharedMic } from "./mic";
import { createLiveSocket, liveUrl, type LiveSocket } from "./liveSocket";
import { createAutoEnd, type AutoEnd } from "./autoEnd";
import { reduce, view, isTap, initialState, type VoiceState } from "./voiceMachine";
import { browserSpeak } from "./tts";
import { buildReceipt, saveReceipt, type CallCard } from "./storage";

interface WakeLockLike { release?: () => Promise<void> }

export function useVoiceCall(opts: { threadLen: number; onBeforeStart?: () => void; onExit?: () => void }) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cards, setCards] = useState<CallCard[]>([]);
  const [note, setNote] = useState("");

  const desktopRef = useRef(false);
  const stateRef = useRef<VoiceState>(state);
  stateRef.current = state;

  const socket = useRef<LiveSocket | null>(null);
  const closingRef = useRef(false);
  const pushedRef = useRef(false);
  const wakeRef = useRef<WakeLockLike | null>(null);
  const pressT0 = useRef(0);
  const consumed = useRef(false);
  const meterRAF = useRef(0);
  const startedAt = useRef(0);
  const timerId = useRef<ReturnType<typeof setInterval> | null>(null);
  const talkRef = useRef<HTMLButtonElement | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<CallCard[]>([]);

  const autoEnd = useRef<AutoEnd | null>(null);
  if (autoEnd.current === null) {
    autoEnd.current = createAutoEnd({
      onEnd: () => { endTurnIO(); dispatch({ type: "HOLD" }); },
      onNoSpeech: () => { endTurnIO(); dispatch({ type: "SPEECH_TIMEOUT" }); },
    });
  }

  useEffect(() => { desktopRef.current = typeof matchMedia !== "undefined" && matchMedia("(hover: hover)").matches; }, []);

  // ---- level meter + latched auto-end sampling ----
  function setLvl(v: number) {
    const s = String(Math.min(1, v * 6).toFixed(2));
    talkRef.current?.style.setProperty("--lvl", s);
    orbRef.current?.style.setProperty("--lvl", s);
  }
  function clearLvl() {
    talkRef.current?.style.removeProperty("--lvl");
    orbRef.current?.style.removeProperty("--lvl");
  }
  const meter = useCallback(() => {
    const st = stateRef.current;
    if (st.phase !== "listening") { clearLvl(); return; }
    setLvl(sharedMic.level);
    if (st.latched) autoEnd.current?.sample(sharedMic.level, performance.now());
    meterRAF.current = requestAnimationFrame(meter);
  }, []);

  // ---- turn I/O ----
  function beginTurnIO() {
    const sock = socket.current;
    if (!sock || sock.readyState !== 1) return;
    sharedMic.flushOutput();
    sharedMic.capturing = true;
    sharedMic.sink = (f) => sock.sendPCM(f);
    sock.send({ type: "start" });
    autoEnd.current?.reset();
    navigator.vibrate?.(8);
    cancelAnimationFrame(meterRAF.current);
    meterRAF.current = requestAnimationFrame(meter);
  }
  function endTurnIO() {
    sharedMic.capturing = false;
    sharedMic.sink = null;
    socket.current?.send({ type: "end" });
    autoEnd.current?.reset();
    navigator.vibrate?.(8);
    cancelAnimationFrame(meterRAF.current);
    clearLvl();
  }

  // ---- socket ----
  const connect = useCallback(() => {
    closingRef.current = false;
    socket.current = createLiveSocket(liveUrl(process.env.NEXT_PUBLIC_LIVE_WS_URL, window.location), {
      onOpen: () => { /* status stays 'connecting' until 'ready' */ },
      onClose: () => { if (!closingRef.current) dispatch({ type: "SOCKET_CLOSED" }); },
      onAudio: (buf) => { dispatch({ type: "AUDIO" }); sharedMic.play24k(buf); },
      onMessage: (m) => {
        switch (m.type) {
          case "ready": dispatch({ type: "READY" }); break;
          case "card": {
            const c: CallCard = { url: m.url, title: m.title, subtitle: m.subtitle };
            cardsRef.current = [...cardsRef.current, c];
            setCards(cardsRef.current);
            break;
          }
          case "interrupted": sharedMic.flushOutput(); break;
          case "turn": dispatch({ type: "TURN" }); break;
          case "guardrail":
            sharedMic.flushOutput();
            setNote(m.text);
            dispatch({ type: "GUARDRAIL" });
            try { browserSpeak(m.text); } catch { /* ignore */ }
            break;
          case "info": if (m.text === "call-time-limit") { dispatch({ type: "TIME_LIMIT" }); endCall(); } break;
          case "error": dispatch({ type: "ERROR", text: m.text }); break;
          // "user"/"bot" transcripts are intentionally ignored: the stage shows the orb.
        }
      },
    });
  }, []);

  async function requestWake() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> } };
      wakeRef.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch { /* ignore */ }
  }

  // ---- entry / exit ----
  const startCall = useCallback(async () => {
    if (active) return;
    opts.onBeforeStart?.();
    cardsRef.current = [];
    setCards([]); setNote(""); setElapsed(0);
    dispatch({ type: "RESET" });
    setActive(true);
    pushedRef.current = true;
    try { window.history.pushState({ voice: true }, ""); } catch { /* ignore */ }
    void requestWake();
    const ok = await sharedMic.open();
    if (!ok) { dispatch({ type: "ERROR", text: sharedMic.errMessage() }); return; }
    startedAt.current = Date.now();
    if (timerId.current) clearInterval(timerId.current);
    timerId.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    connect();
  }, [active, connect, opts]);

  const endCall = useCallback((fromPop = false) => {
    if (!active && !fromPop) return;
    closingRef.current = true;
    endTurnIO();
    socket.current?.close();
    socket.current = null;
    sharedMic.close();
    void wakeRef.current?.release?.().catch(() => {});
    wakeRef.current = null;
    if (timerId.current) { clearInterval(timerId.current); timerId.current = null; }
    cancelAnimationFrame(meterRAF.current);
    const ms = startedAt.current ? Date.now() - startedAt.current : 0;
    const receipt = buildReceipt(opts.threadLen, ms, cardsRef.current);
    if (receipt) saveReceipt(receipt);
    if (pushedRef.current && !fromPop) { try { window.history.back(); } catch { /* ignore */ } }
    pushedRef.current = false;
    setActive(false);
    opts.onExit?.();
  }, [active, opts]);

  // ---- gesture ----
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const st = stateRef.current;
    if (st.phase === "dropped") { dispatch({ type: "RECONNECT" }); connect(); consumed.current = true; return; }
    if (st.phase === "listening" && st.latched) { endTurnIO(); dispatch({ type: "PRESS" }); consumed.current = true; return; }
    if (st.phase === "speaking") sharedMic.flushOutput();
    if (!(st.phase === "idle" || st.phase === "thinking" || st.phase === "guardrail" || st.phase === "speaking")) { consumed.current = true; return; }
    dispatch({ type: "PRESS" });
    beginTurnIO();
    pressT0.current = performance.now();
    consumed.current = false;
  }, [connect]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (consumed.current) { consumed.current = false; return; }
    if (stateRef.current.phase !== "listening") return;
    if (isTap(pressT0.current, performance.now())) { dispatch({ type: "TAP" }); autoEnd.current?.reset(); }
    else { endTurnIO(); dispatch({ type: "HOLD" }); }
  }, []);

  const onPointerCancel = useCallback(() => {
    if (stateRef.current.phase === "listening" && !stateRef.current.latched) { endTurnIO(); dispatch({ type: "HOLD" }); }
  }, []);

  // ---- window-level listeners while the call is open ----
  useEffect(() => {
    if (!active) return;
    const typin = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "TEXTAREA" || t.tagName === "INPUT");
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") { endCall(); return; }
      if (e.code !== "Space" || e.repeat || typin(e.target)) return;
      const st = stateRef.current;
      if (st.phase !== "idle" && st.phase !== "thinking" && st.phase !== "speaking" && st.phase !== "guardrail") return;
      e.preventDefault();
      if (st.phase === "speaking") sharedMic.flushOutput();
      dispatch({ type: "PRESS" });
      beginTurnIO();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typin(e.target)) return;
      e.preventDefault();
      if (stateRef.current.phase === "listening") { endTurnIO(); dispatch({ type: "HOLD" }); }
    };
    const onPop = () => endCall(true);
    const onBlur = () => { if (stateRef.current.phase === "listening" && !stateRef.current.latched) { endTurnIO(); dispatch({ type: "HOLD" }); } };
    const onVis = () => {
      if (document.visibilityState === "hidden") onBlur();
      else void requestWake();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("popstate", onPop);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, endCall]);

  const v = view(state, desktopRef.current);
  const hint = state.phase === "listening"
    ? (state.latched ? "Tap again, or just stop talking." : "Release to answer.")
    : "";

  return {
    active, view: v, elapsed, cards, note, hint,
    startCall, endCall: () => endCall(false),
    talkRef, orbRef, onPointerDown, onPointerUp, onPointerCancel,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run lib/useVoiceCall.test.tsx lib/tts.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/lib/useVoiceCall.ts frontend/lib/useVoiceCall.test.tsx frontend/lib/tts.ts frontend/lib/tts.test.ts frontend/lib/storage.ts
git commit -m "feat(frontend): voice-call orchestration hook (mic, socket, machine, gesture)"
```

---

### Task 7: `VoiceStage` + `TalkButton` + `Orb` states

**Files:**
- Create: `frontend/components/TalkButton.tsx`, `frontend/components/TalkButton.test.tsx`
- Create: `frontend/components/VoiceStage.tsx`, `frontend/components/VoiceStage.test.tsx`
- Modify: `frontend/components/Orb.tsx` (add `desaturated`/`frozen`)

**Interfaces:**
- Consumes: `VoiceView` (Task 2), the hook's handlers/refs (Task 6), `LinkCard` (existing).
- Produces: `TalkButton` (presentational — label/style from `view`, forwards pointer handlers, holds `talkRef`); `VoiceStage` (fixed modal dialog — timer, X, disclaimer, `Orb`, `aria-live` status, cards region, `TalkButton`, hint, Type-instead).

- [ ] **Step 1: Extend `frontend/components/Orb.tsx`**
```tsx
import clsx from "clsx";

export function Orb({
  state,
  desaturated,
  frozen,
  className,
  refEl,
}: {
  state?: "idle" | "listening" | "thinking" | "speaking";
  desaturated?: boolean;
  frozen?: boolean;
  className?: string;
  refEl?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={refEl}
      className={clsx("orb", state, desaturated && "orb-desat", frozen && "orb-frozen", className)}
      aria-hidden="true"
    >
      <span className="orb-glow" />
      <span className="orb-ring" />
      <span className="orb-core" />
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/components/TalkButton.tsx`**
```tsx
"use client";
import clsx from "clsx";
import type { VoiceView } from "@/lib/voiceMachine";

export function TalkButton({
  view,
  talkRef,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: {
  view: VoiceView;
  talkRef: React.Ref<HTMLButtonElement>;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
}) {
  if (view.buttonHidden) return null;
  return (
    <button
      ref={talkRef}
      type="button"
      className={clsx("talk-btn", view.buttonActive && "on", view.showLevel && "leveled")}
      disabled={view.buttonDisabled}
      aria-label={view.buttonLabel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="talk-dot" aria-hidden="true" />
      <span className="talk-label">{view.buttonLabel}</span>
    </button>
  );
}
```

- [ ] **Step 3: Write `frontend/components/TalkButton.test.tsx`**
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { TalkButton } from "./TalkButton";
import { view } from "@/lib/voiceMachine";

const props = (v: ReturnType<typeof view>) => ({
  view: v, talkRef: createRef<HTMLButtonElement>(),
  onPointerDown: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn(),
});

describe("TalkButton", () => {
  it("shows the phase label and disables when the view says so", () => {
    render(<TalkButton {...props(view({ phase: "connecting", latched: false, note: "", errorText: "" }, false))} />);
    expect(screen.getByRole("button", { name: "Tap to talk" })).toBeDisabled();
  });
  it("is absent when the view hides the button", () => {
    render(<TalkButton {...props(view({ phase: "ended", latched: false, note: "", errorText: "" }, false))} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 4: Write `frontend/components/VoiceStage.tsx`**
```tsx
"use client";
import { useEffect, useRef } from "react";
import type { VoiceView } from "@/lib/voiceMachine";
import type { CallCard } from "@/lib/storage";
import { Orb } from "./Orb";
import { LinkCard } from "./LinkCard";
import { TalkButton } from "./TalkButton";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function VoiceStage({
  view,
  elapsed,
  cards,
  note,
  hint,
  talkRef,
  orbRef,
  onClose,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: {
  view: VoiceView;
  elapsed: number;
  cards: CallCard[];
  note: string;
  hint: string;
  talkRef: React.Ref<HTMLButtonElement>;
  orbRef: React.Ref<HTMLDivElement>;
  onClose: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  return (
    <div className="voice-stage" role="dialog" aria-modal="true" aria-label="Call with the professor">
      <div className="vs-bar">
        <span className="vs-timer" aria-hidden="true">{fmt(elapsed)}</span>
        <button ref={closeRef} type="button" className="vs-x" aria-label="End call" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
      <p className="vs-disclaimer">General information only — not medical advice. In an emergency call 999 or NHS 111.</p>

      <div className="vs-middle">
        <Orb refEl={orbRef} state={view.orb} desaturated={view.desaturated} frozen={view.frozen} className="stage-orb" />
        <p className="vs-status" aria-live="polite">{view.status}</p>
        <div className="vs-cards">
          {note && <div className="voice-note">{note}</div>}
          {cards.map((c, i) => (
            <LinkCard key={i} href={c.url} title={c.title} subtitle={c.subtitle} />
          ))}
        </div>
      </div>

      <div className="vs-foot">
        <TalkButton view={view} talkRef={talkRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} />
        <p className="vs-hint" aria-live="polite">{hint}</p>
        <button type="button" className="vs-type" onClick={onClose}>Type instead</button>
      </div>
    </div>
  );
}
```
> Note: `LinkCard` already renders `target="_blank" rel="noopener"` and appends " · Tap to open" to the subtitle itself — pass the bare `subtitle` (or omit it). **No change to `LinkCard` is needed.**

- [ ] **Step 5: Write `frontend/components/VoiceStage.test.tsx`**
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { VoiceStage } from "./VoiceStage";
import { view } from "@/lib/voiceMachine";

const base = {
  elapsed: 134, cards: [], note: "", hint: "",
  talkRef: createRef<HTMLButtonElement>(), orbRef: createRef<HTMLDivElement>(),
  onClose: vi.fn(), onPointerDown: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn(),
};

describe("VoiceStage", () => {
  it("is a modal dialog with a live status and formatted timer", () => {
    render(<VoiceStage {...base} view={view({ phase: "listening", latched: false, note: "", errorText: "" }, false)} />);
    expect(screen.getByRole("dialog", { name: /call with the professor/i })).toBeInTheDocument();
    expect(screen.getByText("02:14")).toBeInTheDocument();
    expect(screen.getByText("Listening…")).toBeInTheDocument();
  });
  it("renders a guardrail voice-note and dropped cards", () => {
    render(
      <VoiceStage
        {...base}
        note="Please call 999 now."
        cards={[{ url: "https://x.co", title: "Peptides 101", subtitle: "My Peptides" }]}
        view={view({ phase: "guardrail", latched: false, note: "", errorText: "" }, false)}
      />,
    );
    expect(screen.getByText("Please call 999 now.")).toBeInTheDocument();
    expect(screen.getByText("Peptides 101")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run components/TalkButton.test.tsx components/VoiceStage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add frontend/components/Orb.tsx frontend/components/TalkButton.tsx frontend/components/TalkButton.test.tsx frontend/components/VoiceStage.tsx frontend/components/VoiceStage.test.tsx
git commit -m "feat(frontend): voice stage, talk button and orb call states"
```

---

### Task 8: Wire the call into the shell + receipts + CSS

**Files:**
- Modify: `frontend/components/ChatShell.tsx` (mount `VoiceStage`, wire `useVoiceCall`, render receipts)
- Modify: `frontend/components/Composer.tsx` (stop dictation before entering a call)
- Modify: `frontend/lib/useReadAloud.ts` (expose `stop`)
- Create: `frontend/components/CallReceipt.tsx`
- Modify: `frontend/lib/storage.test.ts` (cover receipts + `clearChat` clearing them)
- Modify: `frontend/app/globals.css` (stage, talk button, orb states, level bar)

**Interfaces:**
- Consumes: `useVoiceCall` (Task 6), `loadReceipts`/`buildReceipt` (Task 6 Step 0), `VoiceStage` (Task 7).
- Produces: a working call reachable from the composer key, the rail row, and (empty-state) the composer; a `CallReceipt` divider row rendered from `np-receipts`; the Iris stage styling.

- [ ] **Step 1: Cover the receipt storage in `frontend/lib/storage.test.ts`** — add (import the new fns in the top line):
```ts
import { loadReceipts, saveReceipt, buildReceipt, clearReceipts } from "./storage";

describe("call receipts", () => {
  it("buildReceipt returns null under 5s with no cards, else N min", () => {
    expect(buildReceipt(0, 3000, [])).toBeNull();
    expect(buildReceipt(2, 120000, [])).toMatchObject({ at: 2, mins: 2 });
    expect(buildReceipt(0, 1000, [{ url: "u", title: "t" }])).toMatchObject({ mins: 1 });
  });
  it("saveReceipt round-trips and clearReceipts empties", () => {
    saveReceipt({ at: 1, mins: 2, cards: [], ts: 1 });
    expect(loadReceipts()).toHaveLength(1);
    clearReceipts();
    expect(loadReceipts()).toEqual([]);
  });
});
```
Also assert `clearChat()` clears receipts — extend the existing "clears both" test with `saveReceipt(...)` before `clearChat()` and `expect(loadReceipts()).toEqual([])` after. (Requires the `CKEY` removal added to `clearChat` in Task 6 Step 0.)

- [ ] **Step 2: Expose `stop` from `frontend/lib/useReadAloud.ts`** — add a `stop` callback and return it:
```ts
  const stop = useCallback(() => { speaker.current?.stop(); }, []);
```
and change the return to `return { on, toggle, speakReply, stop };`.

- [ ] **Step 3: Write `frontend/components/CallReceipt.tsx`**
```tsx
import { LinkCard } from "./LinkCard";
import type { CallReceipt as Receipt } from "@/lib/storage";

export function CallReceipt({ receipt }: { receipt: Receipt }) {
  return (
    <div className="call-receipt">
      <div className="cr-divider" role="separator">
        <span>Voice call · {receipt.mins} min</span>
      </div>
      {receipt.cards.map((c, i) => (
        <div className="thread-cards" key={i}>
          <LinkCard href={c.url} title={c.title} subtitle={c.subtitle} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Stop dictation before a call in `frontend/components/Composer.tsx`**

Where the empty-state key calls `onCall`, guard it so an in-progress dictation is dropped first. Replace the call button's `onClick={onCall}` with:
```tsx
              onClick={() => {
                if (dictation.listening) void dictation.toggle();
                onCall?.();
              }}
```
(The mic-drop is best-effort; `dictation.toggle()` while listening stops and would transcribe — acceptable, or expose a `cancel` later. For this pass, stopping is enough to satisfy "never run while a call is open".)

- [ ] **Step 5: Wire `frontend/components/ChatShell.tsx`**

Add imports:
```tsx
import { useReadAloud } from "@/lib/useReadAloud";
import { useVoiceCall } from "@/lib/useVoiceCall";
import { VoiceStage } from "./VoiceStage";
import { CallReceipt } from "./CallReceipt";
import { loadReceipts, type CallReceipt as Receipt } from "@/lib/storage";
```
Replace the hook block with:
```tsx
  const readAloud = useReadAloud();
  const { messages, busy, started, send, newChat } = useChat({ onReplyComplete: readAloud.speakReply });
  const [drawer, setDrawer] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  useEffect(() => { setReceipts(loadReceipts()); }, []);
  const voice = useVoiceCall({
    threadLen: messages.length,
    onBeforeStart: readAloud.stop,
    onExit: () => setReceipts(loadReceipts()),
  });
  const scrollRef = useRef<HTMLDivElement>(null);
```
Make `newChat` also drop receipts — wrap it:
```tsx
  const startNewChat = () => { newChat(); setReceipts([]); };
```
Pass `voice.startCall` to the entries and use `startNewChat` in the header/rail:
```tsx
      <SideNav open={drawer} onClose={() => setDrawer(false)} onNewChat={startNewChat} onCall={voice.startCall} readAloud={readAloud} />
      ...
        <Header onMenu={() => setDrawer(true)} onNewChat={startNewChat} />
      ...
        <Composer busy={busy} onSend={send} onCall={voice.startCall} />
```
Render receipts after the thread cards (inside `.thread`, after the guide-cards block):
```tsx
            {receipts.map((r, i) => (
              <CallReceipt key={`r-${r.ts}-${i}`} receipt={r} />
            ))}
```
Mount the stage at the end of `.app`:
```tsx
      {voice.active && (
        <VoiceStage
          view={voice.view}
          elapsed={voice.elapsed}
          cards={voice.cards}
          note={voice.note}
          hint={voice.hint}
          talkRef={voice.talkRef}
          orbRef={voice.orbRef}
          onClose={voice.endCall}
          onPointerDown={voice.onPointerDown}
          onPointerUp={voice.onPointerUp}
          onPointerCancel={voice.onPointerCancel}
        />
      )}
```

- [ ] **Step 6: Add the stage styling** — append to `frontend/app/globals.css`:
```css
@layer components {
  .voice-stage{position:fixed; inset:0; z-index:50; display:flex; flex-direction:column; align-items:center;
    background:radial-gradient(120% 80% at 50% 32%, var(--color-iris-50), var(--color-bg) 62%);
    padding:0 20px max(18px,env(safe-area-inset-bottom)); animation:vs-in 320ms var(--ease,ease)}
  .vs-bar{width:100%; max-width:560px; height:56px; display:flex; align-items:center; justify-content:space-between}
  .vs-timer{color:var(--color-ink-3); font-variant-numeric:tabular-nums; font-size:14px}
  .vs-x{width:44px; height:44px; display:grid; place-items:center; border-radius:var(--radius-full); border:1px solid var(--color-line); background:var(--color-surface); color:var(--color-ink-2); cursor:pointer}
  .vs-disclaimer{max-width:560px; text-align:center; color:var(--color-ink-3); font-size:12px; margin:0 0 8px}
  .vs-middle{flex:1; width:100%; max-width:480px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; overflow-y:auto}
  .vs-status{font-size:16px; font-weight:600; color:var(--color-ink-2); text-align:center; margin:0}
  .vs-cards{width:100%; display:flex; flex-direction:column; gap:10px}
  .voice-note{padding:12px 14px; border-radius:var(--radius-lg,16px); background:var(--color-surface); border:1px solid var(--color-line); color:var(--color-ink-1); font-size:14px}
  .vs-foot{width:100%; max-width:480px; display:flex; flex-direction:column; align-items:center; gap:8px; padding-top:12px}
  .talk-btn{width:100%; max-width:420px; min-height:64px; display:flex; align-items:center; justify-content:center; gap:10px;
    border-radius:var(--radius-xl,22px); border:1px solid var(--color-line); background:var(--color-surface); color:var(--color-ink-1);
    font-size:16px; font-weight:600; cursor:pointer; touch-action:none; user-select:none; -webkit-touch-callout:none}
  .talk-btn:disabled{opacity:.55; cursor:default}
  .talk-btn.on{background:var(--color-iris-600); border-color:transparent; color:#fff; animation:hold-pulse 1.6s infinite}
  .talk-btn.leveled{box-shadow:0 0 0 calc(2px + var(--lvl,0) * 10px) rgba(91,75,214,.20)}
  .talk-dot{width:12px; height:12px; border-radius:50%; background:currentColor}
  .vs-hint{min-height:1.1em; color:var(--color-ink-2); font-size:13.5px; text-align:center; margin:0}
  .vs-type{background:none; border:0; color:var(--color-ink-3); font-size:14px; text-decoration:underline; cursor:pointer}
  .stage-orb{width:clamp(150px,46vw,210px); margin:0 auto}
  .orb.orb-desat{filter:saturate(.55) brightness(.98)}
  .orb.orb-frozen .orb-glow,.orb.orb-frozen .orb-ring,.orb.orb-frozen .orb-core{animation:none!important}
}
@keyframes vs-in{from{opacity:0; transform:translateY(12px)} to{opacity:1; transform:none}}
@keyframes hold-pulse{0%,100%{box-shadow:0 0 0 0 rgba(91,75,214,.40)}50%{box-shadow:0 0 0 8px rgba(91,75,214,0)}}
@media (min-width:1024px){ .stage-orb{width:240px} .vs-status{font-size:17px} }
@media (prefers-reduced-motion:reduce){ .voice-stage{animation:none} .talk-btn.on{animation:none} .talk-btn.leveled{box-shadow:none} }
```
(If any referenced token — `--radius-xl`, `--radius-lg`, `--dur-slow`, `--ease-out` — is not already defined in `@theme`, add it there; the fallbacks in the `var(...)` calls keep the build correct meanwhile.)

- [ ] **Step 7: Full suite + typecheck + build**

Run: `cd frontend && npm run test:run && npm run typecheck && npm run build`
Expected: all pass; build clean; route list still `/`, `/api/*`.

- [ ] **Step 8: Commit**
```bash
git add frontend/components/ChatShell.tsx frontend/components/Composer.tsx frontend/components/CallReceipt.tsx frontend/lib/useReadAloud.ts frontend/lib/storage.test.ts frontend/app/globals.css
git commit -m "feat(frontend): mount voice stage in the shell with call receipts"
```

---

## Self-review — spec coverage (Phase 3 scope)

- Live WS protocol + zod validation, `user`/`bot` ignored, `brand` on cards (spec §5, §8; live.py): Tasks 1, 5. ✓
- Pure turn state machine, every §7 transition + copy selector (spec §7; CHAT_VOICE_MODES §6.1/§7): Task 2. ✓
- Auto-end VAD: 0.015 threshold, 300ms confirm, 1200ms silence, 8s no-speech, 30s cap (CHAT_VOICE_MODES §6.3): Task 3. ✓
- 24kHz PCM playback through the entry-gesture AudioContext + barge-in flush (spec §8; §10 "no autoplay assumptions"): Task 4. ✓
- Entry sequence: gesture mic+ctx, `history.pushState`, stop read-aloud, wakeLock, connect; exits X/Esc/Back/Type-instead/time-limit all via one `endCall` (CHAT_VOICE_MODES §4): Task 6. ✓
- Tap/hold/latch ordered gesture + Space (never latches, text-field guarded) + haptics (CHAT_VOICE_MODES §6.2): Task 6. ✓
- Stage: modal dialog, timer, disclaimer, orb, `aria-live` status, cards/voice-note, 64px talk button, hint, Type-instead; reduced-motion (CHAT_VOICE_MODES §5, §10): Task 7. ✓
- Modes separate: cards → receipt not thread; call never writes `history[]`; entering stops read-aloud + dictation (CHAT_VOICE_MODES §1, §8): Tasks 6, 8. ✓
- "Voice call · N min" receipt, `np-receipts`, <5s+no-cards shows nothing, cleared by New chat (CHAT_VOICE_MODES §6.4): Tasks 6, 8. ✓
- Testing (spec §13): machine (all transitions), autoEnd (fake clock), liveSocket (zod + fake WS), schemas, pcm converter, receipt builder, TalkButton/VoiceStage per-phase, hook integration — Vitest. Real WebAudio/WS manual. ✓

**Type consistency:** `VoiceView` produced by `view()` (Task 2) is consumed unchanged by `TalkButton`/`VoiceStage` (Task 7); `CallCard`/`CallReceipt`/`buildReceipt`/`saveReceipt`/`loadReceipts` defined in `storage.ts` (Task 6 Step 0) and used by the hook (Task 6) and `CallReceipt`/`ChatShell` (Task 8); `sharedMic.play24k`/`flushOutput` (Task 4) consumed by the hook (Task 6); `createLiveSocket(url, handlers, WS?)`/`liveUrl` (Task 5) consumed by the hook; `useReadAloud` gains `stop` (Task 8) consumed by `ChatShell`; the existing `Composer`/`SideNav` `onCall?` seam (Phase 1) is now supplied by `voice.startCall`.

**Deferred to Phase 4 (named seams, not placeholders):** native guide routes (`/guides`, `/guides/[slug]`) — the call's guide cards and receipt cards deep-link to `/guides/<slug>` via the existing `LinkCard`, which Phase 4 makes real routes.

## Manual verification (needs the backend authenticated + HTTPS/localhost)

With ADC set on the backend and the app on `localhost`/HTTPS: tap the composer key → mic asked once → stage opens (orb grows from the hero on the empty state, slides up from a conversation). Tap → **listening**; tap again → **thinking** → reply plays (**speaking**); tap during the reply cuts it off. Hold ≥250ms → listening until release. On a latched turn, stop talking ~1.2s → the turn ends itself; say nothing for 8s → "Didn't catch that." Space (desktop) talks and never latches. Browser Back, Escape, X, and Type-instead all end the call and land on the same chat view, leaving a "Voice call · N min" divider (with any cards); `history[]` untouched. Verify at mobile and `lg` (stage covers the whole window), and with reduced-motion + keyboard-only.
