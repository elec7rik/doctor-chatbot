# Read-Aloud & Dictation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the two in-chat voice features to the Next.js product — **read-aloud** (a setting that speaks completed bot replies via `/tts`) and **dictation** (a composer mic that turns speech into text via `/stt`) — sharing one microphone pipeline, with the BFF routes to proxy both.

**Architecture:** A framework-agnostic shared-mic module (`lib/mic.ts`) captures 16 kHz mono PCM; a TTS speaker module (`lib/tts.ts`) streams head+tail audio from a new `/api/tts` BFF route with a browser-voice fallback; two BFF routes (`/api/tts`, `/api/stt`) proxy the FastAPI endpoints. React hooks (`useReadAloud`, `useDictation`) wrap them; `useChat` gains a reply-completion callback so read-aloud can speak finished replies; `ReadAloudSwitch` becomes controlled and the composer mic is enabled.

**Tech Stack:** Same as Phase 1 — Next.js 16, React 19, TS strict, Tailwind v4, zod v4, Vitest 4 + Testing Library (jsdom).

This is Phase 2 of 4. It implements spec `docs/superpowers/specs/2026-09-04-nextjs-chat-agent-design.md` §6 (`mic.ts`, `tts.ts`, `useReadAloud`, `useDictation`), §8 (read-aloud + dictation flows), and `design/CHAT_VOICE_MODES.md` §2.3, §7, §8. The live voice **call** (WebSocket, orb stage, state machine) remains Phase 3.

## Global Constraints

- The backend is **unchanged**. Contracts (from `backend/app/main.py`):
  - `POST /tts` — JSON body `{text}` → audio bytes with an upstream media type; `429` returns text `rate_limited`; `502` on synth error. **Any non-200 means: fall back to the browser voice.**
  - `POST /stt` — raw body of 16 kHz 16-bit mono PCM (`application/octet-stream`) → JSON `{text}`; `429` `rate_limited`; `413` `too_long`; `502` on error.
- BFF routes run on the **nodejs** runtime, read `BACKEND_URL` **inside the handler** (default `http://localhost:8000`), and never expose it to the client. (Same pattern as `app/api/chat/stream/route.ts`.)
- Read-aloud is **off by default**, persisted under `np-readaloud`. Dictation must **never** open a voice call and must not run while a call is open (call is Phase 3; guard now).
- Mic requires **HTTPS or localhost**; on failure surface `errMessage()` copy, never a crash.
- Respect `prefers-reduced-motion` for the mic recording pulse.
- PCM downsample target is **16 kHz**; STT is sent only when the clip is ≥ 0.3 s of audio (`16000 * 0.3` samples), matching the prototype.
- Reuse the prototype logic in `backend/app/static/index.html` (mic `micOpen/micClose/onaudioprocess`, TTS `splitHead/fetchTTS/playBlob/speak/stopSpeaking`, composer-mic handler) — port it, don't reinvent.

---

### Task 1: `lib/mic.ts` — shared 16 kHz PCM microphone

**Files:**
- Create: `frontend/lib/mic.ts`, `frontend/lib/mic.test.ts`

**Interfaces:**
- Produces (pure, tested): `rms(buf: Float32Array): number`; `downsampleTo16k(input: Float32Array, inputRate: number): Int16Array`.
- Produces (controller, manually verified — WebAudio can't run in jsdom): `interface Mic { open(): Promise<boolean>; close(): void; readonly level: number; capturing: boolean; sink: ((frame: Int16Array) => void) | null; readonly errName: string; errMessage(): string }` and a module singleton `sharedMic: Mic` reused by dictation (this plan) and the voice call (Phase 3).

- [ ] **Step 1: Write the pure-helper test** — `frontend/lib/mic.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { rms, downsampleTo16k } from "./mic";

describe("mic DSP helpers", () => {
  it("rms of a constant signal equals its magnitude", () => {
    const buf = new Float32Array(100).fill(0.5);
    expect(rms(buf)).toBeCloseTo(0.5, 5);
  });
  it("rms of silence is 0", () => {
    expect(rms(new Float32Array(64))).toBe(0);
  });
  it("downsampleTo16k halves a 32kHz buffer and clamps to int16", () => {
    const input = new Float32Array(320).fill(1);
    const out = downsampleTo16k(input, 32000);
    expect(out).toBeInstanceOf(Int16Array);
    expect(out.length).toBe(160);
    expect(out[0]).toBe(32767); // +1.0 -> 0x7FFF
  });
  it("downsampleTo16k maps -1.0 to -32768", () => {
    const out = downsampleTo16k(new Float32Array(64).fill(-1), 16000);
    expect(out[0]).toBe(-32768); // -1.0 -> -0x8000
    expect(out.length).toBe(64); // already 16k -> ratio 1
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/mic.test.ts`
Expected: FAIL — cannot find module `./mic`.

- [ ] **Step 3: Write `frontend/lib/mic.ts`**
```ts
export function rms(buf: Float32Array): number {
  let sq = 0;
  for (let i = 0; i < buf.length; i++) sq += buf[i]! * buf[i]!;
  return Math.sqrt(sq / buf.length);
}

/** Average-downsample a Float32 PCM window to 16 kHz signed 16-bit samples. */
export function downsampleTo16k(input: Float32Array, inputRate: number): Int16Array {
  const ratio = inputRate / 16000;
  const n = Math.floor(input.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.floor((i + 1) * ratio);
    let s = 0;
    let c = 0;
    for (let j = a; j < b && j < input.length; j++) {
      s += input[j]!;
      c++;
    }
    s = c ? s / c : 0;
    s = Math.max(-1, Math.min(1, s));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

interface AudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

interface MicState {
  ctx: AudioContext | null;
  stream: MediaStream | null;
  src: MediaStreamAudioSourceNode | null;
  proc: ScriptProcessorNode | null;
}

class SharedMic {
  private s: MicState = { ctx: null, stream: null, src: null, proc: null };
  level = 0;
  capturing = false;
  sink: ((frame: Int16Array) => void) | null = null;
  errName = "";

  async open(): Promise<boolean> {
    if (this.s.stream) return true;
    try {
      this.s.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      this.errName = (e as Error).name || "error";
      return false;
    }
    const Ctx = window.AudioContext || (window as AudioWindow).webkitAudioContext!;
    const ctx = new Ctx();
    this.s.ctx = ctx;
    this.s.src = ctx.createMediaStreamSource(this.s.stream);
    this.s.proc = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    this.s.src.connect(this.s.proc);
    this.s.proc.connect(mute);
    mute.connect(ctx.destination);
    this.s.proc.onaudioprocess = (e) => {
      const inp = e.inputBuffer.getChannelData(0);
      this.level = rms(inp);
      if (!this.capturing || !this.sink) return;
      this.sink(downsampleTo16k(inp, ctx.sampleRate));
    };
    return true;
  }

  close(): void {
    try { this.s.proc?.disconnect(); } catch { /* ignore */ }
    try { this.s.src?.disconnect(); } catch { /* ignore */ }
    try { this.s.stream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { void this.s.ctx?.close(); } catch { /* ignore */ }
    this.s = { ctx: null, stream: null, src: null, proc: null };
    this.capturing = false;
    this.sink = null;
  }

  errMessage(): string {
    if (!this.errName) return "Getting the microphone ready…";
    if (this.errName === "NotAllowedError")
      return "Microphone access is blocked for this site. Allow it in your browser's settings, then try again.";
    if (this.errName === "NotFoundError") return "No microphone found.";
    return "Couldn't start the microphone (" + this.errName + ").";
  }
}

export type Mic = SharedMic;
export const sharedMic: Mic = new SharedMic();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/mic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/mic.ts frontend/lib/mic.test.ts
git commit -m "feat(frontend): shared 16kHz PCM microphone with pure DSP helpers"
```

---

### Task 2: BFF Route Handler `POST /api/tts`

**Files:**
- Create: `frontend/app/api/tts/route.ts`, `frontend/app/api/tts/route.test.ts`

**Interfaces:**
- Produces: a Node-runtime handler that validates `{text}` (1–4000 chars), forwards to `${BACKEND_URL}/tts`, and on 200 returns the audio bytes with the upstream `content-type`; on any non-200 returns that status (the client falls back to the browser voice); 400 on invalid body.

- [ ] **Step 1: Write `frontend/app/api/tts/route.test.ts`**
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });
beforeEach(() => { process.env.BACKEND_URL = "http://backend.test"; });

function req(body: unknown) {
  return new Request("http://localhost/api/tts", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/tts", () => {
  it("400s an empty text", async () => {
    expect((await POST(req({ text: "" }))).status).toBe(400);
  });
  it("returns audio bytes with the upstream content-type", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(bytes, { status: 200, headers: { "content-type": "audio/mpeg" } }));
    const res = await POST(req({ text: "hello" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    expect(globalThis.fetch).toHaveBeenCalledWith("http://backend.test/tts", expect.objectContaining({ method: "POST" }));
  });
  it("passes a 502 through so the client can fall back", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("boom", { status: 502 }));
    expect((await POST(req({ text: "hello" }))).status).toBe(502);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run app/api/tts/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write `frontend/app/api/tts/route.ts`**
```ts
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ text: z.string().min(1).max(4000) });
function backendUrl(): string {
  return process.env.BACKEND_URL ?? "http://localhost:8000";
}

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try { json = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return new Response("Invalid request", { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(await upstream.text().catch(() => ""), { status: upstream.status || 502 });
  }
  const buf = await upstream.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: { "content-type": upstream.headers.get("content-type") ?? "audio/mpeg", "cache-control": "no-store" },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run app/api/tts/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/app/api/tts
git commit -m "feat(frontend): BFF route proxying text-to-speech audio"
```

---

### Task 3: BFF Route Handler `POST /api/stt`

**Files:**
- Create: `frontend/app/api/stt/route.ts`, `frontend/app/api/stt/route.test.ts`

**Interfaces:**
- Produces: a Node-runtime handler that forwards the raw request body (PCM) to `${BACKEND_URL}/stt` as `application/octet-stream` and returns the upstream JSON `{text}` on 200, or the upstream status (413/429/502) otherwise.

- [ ] **Step 1: Write `frontend/app/api/stt/route.test.ts`**
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });
beforeEach(() => { process.env.BACKEND_URL = "http://backend.test"; });

function req(bytes: Uint8Array) {
  return new Request("http://localhost/api/stt", {
    method: "POST", headers: { "content-type": "application/octet-stream" }, body: bytes,
  });
}

describe("POST /api/stt", () => {
  it("forwards the PCM body and returns the transcript", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "hello there" }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = await POST(req(new Uint8Array([1, 2, 3, 4])));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "hello there" });
    expect(globalThis.fetch).toHaveBeenCalledWith("http://backend.test/stt", expect.objectContaining({ method: "POST" }));
  });
  it("passes a 413 through", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("too_long", { status: 413 }));
    expect((await POST(req(new Uint8Array([1])))).status).toBe(413);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run app/api/stt/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write `frontend/app/api/stt/route.ts`**
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendUrl(): string {
  return process.env.BACKEND_URL ?? "http://localhost:8000";
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.arrayBuffer();
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/stt`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body,
    });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }
  const text = await upstream.text().catch(() => "");
  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run app/api/stt/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/app/api/stt
git commit -m "feat(frontend): BFF route proxying speech-to-text"
```

---

### Task 4: `lib/storage.ts` + `lib/markdown.ts` additions

**Files:**
- Modify: `frontend/lib/storage.ts`, `frontend/lib/storage.test.ts`
- Modify: `frontend/lib/markdown.ts`, `frontend/lib/markdown.test.ts`

**Interfaces:**
- Produces: `loadReadAloud(): boolean`, `saveReadAloud(on: boolean): void` (key `np-readaloud`, value `"1"`/`"0"`); `toSpeechText(full: string): string` (reply → plain spoken text: disclaimer + guide tokens removed, markdown formatting stripped, whitespace collapsed).

- [ ] **Step 1: Add storage tests** — append to `frontend/lib/storage.test.ts`:
```ts
import { loadReadAloud, saveReadAloud } from "./storage";

describe("read-aloud pref", () => {
  it("defaults off and round-trips", () => {
    expect(loadReadAloud()).toBe(false);
    saveReadAloud(true);
    expect(loadReadAloud()).toBe(true);
    saveReadAloud(false);
    expect(loadReadAloud()).toBe(false);
  });
});
```
(Keep the existing `beforeEach(() => localStorage.clear())`.)

- [ ] **Step 2: Add markdown test** — append to `frontend/lib/markdown.test.ts`:
```ts
import { toSpeechText } from "./markdown";

describe("toSpeechText", () => {
  it("strips markdown, tiers, guide tokens and links to plain speech", () => {
    const out = toSpeechText("Try **magnesium** *Promising* and `zinc`. See [the guide](https://x.co). [[guide:better-sleep]]");
    expect(out).toBe("Try magnesium Promising and zinc. See the guide.");
  });
  it("drops heading and list markers", () => {
    expect(toSpeechText("# Sleep\n- one\n- two")).toBe("Sleep one two");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npx vitest run lib/storage.test.ts lib/markdown.test.ts`
Expected: FAIL — `loadReadAloud`/`toSpeechText` are not exported.

- [ ] **Step 4: Implement**

Append to `frontend/lib/storage.ts`:
```ts
const RKEY = "np-readaloud";
export function loadReadAloud(): boolean {
  try { return localStorage.getItem(RKEY) === "1"; } catch { return false; }
}
export function saveReadAloud(on: boolean): void {
  try { localStorage.setItem(RKEY, on ? "1" : "0"); } catch { /* ignore */ }
}
```

Append to `frontend/lib/markdown.ts` (uses the existing `stripDisclaimer`/`stripGuideTokens`):
```ts
export function toSpeechText(full: string): string {
  let t = stripDisclaimer(stripGuideTokens(full));
  t = t
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(Strong|Moderate|Promising|Animal-only)\*/g, "$1")
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+[.)]\s+/gm, "");
  return t.replace(/\s+/g, " ").trim();
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run lib/storage.test.ts lib/markdown.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/lib/storage.ts frontend/lib/storage.test.ts frontend/lib/markdown.ts frontend/lib/markdown.test.ts
git commit -m "feat(frontend): read-aloud pref storage and reply-to-speech text helper"
```

---

### Task 5: `lib/tts.ts` — speaker (server TTS + browser fallback)

**Files:**
- Create: `frontend/lib/tts.ts`, `frontend/lib/tts.test.ts`

Port `splitHead`, `fetchTTS`, `playBlob`, `speak`, `stopSpeaking`, `browserSpeak` from `backend/app/static/index.html` (lines ~469–547) into a typed `Speaker`.

**Interfaces:**
- Produces (pure, tested): `splitHead(text: string): [string, string]`.
- Produces (tested against mocked `fetch`): `fetchTTS(text: string, signal?: AbortSignal): Promise<Blob>` (POST `/api/tts`).
- Produces (manually verified — `HTMLAudioElement` playback isn't real in jsdom): `interface Speaker { speak(text: string): Promise<void>; stop(): void }`; `createSpeaker(): Speaker`. `speak` fetches head+tail in parallel, plays them in order guarded by a `speakSeq`, and on any failure/blocked-autoplay falls back to `speechSynthesis`.

- [ ] **Step 1: Write `frontend/lib/tts.test.ts`**
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { splitHead, fetchTTS } from "./tts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

describe("splitHead", () => {
  it("returns a short text as a single head", () => {
    expect(splitHead("Short and sweet.")).toEqual(["Short and sweet.", ""]);
  });
  it("splits a long text into an opener and a tail", () => {
    const long = "First sentence here that is reasonably long. " + "Second follows on. ".repeat(6);
    const [head, tail] = splitHead(long);
    expect(head.length).toBeGreaterThan(0);
    expect(tail.length).toBeGreaterThan(0);
    expect((head + " " + tail).replace(/\s+/g, " ").trim()).toBe(long.replace(/\s+/g, " ").trim());
  });
});

describe("fetchTTS", () => {
  it("POSTs the text to /api/tts and returns a blob", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { status: 200, headers: { "content-type": "audio/mpeg" } }));
    const blob = await fetchTTS("hi");
    expect(blob).toBeInstanceOf(Blob);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/tts", expect.objectContaining({ method: "POST" }));
  });
  it("throws on a non-200 so the caller can fall back", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 502 }));
    await expect(fetchTTS("hi")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/tts.test.ts`
Expected: FAIL — cannot find module `./tts`.

- [ ] **Step 3: Write `frontend/lib/tts.ts`**
```ts
export function splitHead(text: string): [string, string] {
  const t = text.replace(/\s+/g, " ").replace(/([.!?])([A-Z])/g, "$1 $2").trim();
  if (t.length <= 160) return [t, ""];
  const parts = t.split(/(?<=[.!?])\s+/);
  let head = "";
  let i = 0;
  for (; i < parts.length; i++) {
    head = head ? head + " " + parts[i] : parts[i]!;
    if (head.length >= 60) { i++; break; }
  }
  let tail = parts.slice(i).join(" ").trim();
  if (!tail) {
    const cut = t.lastIndexOf(" ", 200);
    const at = cut > 80 ? cut : 200;
    return [t.slice(0, at).trim(), t.slice(at).trim()];
  }
  if (head.length > 240) {
    const cut = head.lastIndexOf(" ", 220);
    const at = cut > 80 ? cut : 220;
    tail = head.slice(at).trim() + " " + tail;
    head = head.slice(0, at).trim();
  }
  return [head, tail];
}

export async function fetchTTS(text: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw new Error("tts " + res.status);
  return await res.blob();
}

const canBrowserTTS = typeof window !== "undefined" && "speechSynthesis" in window;

export interface Speaker {
  speak(text: string): Promise<void>;
  stop(): void;
}

export function createSpeaker(): Speaker {
  let curAudio: HTMLAudioElement | null = null;
  let curAbort: AbortController | null = null;
  let speakSeq = 0;

  function stop(): void {
    speakSeq++;
    if (curAbort) { try { curAbort.abort(); } catch { /* ignore */ } curAbort = null; }
    if (curAudio) { curAudio.pause(); try { URL.revokeObjectURL(curAudio.src); } catch { /* ignore */ } curAudio = null; }
    if (canBrowserTTS) window.speechSynthesis.cancel();
  }

  function browserSpeak(text: string): void {
    if (!canBrowserTTS) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const gb = (window.speechSynthesis.getVoices() || []).find((v) => /en-GB/i.test(v.lang));
    if (gb) u.voice = gb;
    window.speechSynthesis.speak(u);
  }

  function playBlob(blob: Blob, seq: number): Promise<"done" | "stale" | "blocked"> {
    return new Promise((resolve) => {
      if (seq !== speakSeq) { resolve("stale"); return; }
      const audio = new Audio(URL.createObjectURL(blob));
      curAudio = audio;
      const done = (r: "done" | "blocked") => { try { URL.revokeObjectURL(audio.src); } catch { /* ignore */ } resolve(r); };
      audio.addEventListener("ended", () => done("done"), { once: true });
      audio.addEventListener("error", () => done("done"), { once: true });
      audio.addEventListener("pause", () => done("done"), { once: true });
      audio.play().catch(() => done("blocked"));
    });
  }

  async function speak(text: string): Promise<void> {
    if (!text) return;
    stop();
    const seq = speakSeq;
    const ctrl = new AbortController();
    curAbort = ctrl;
    const [head, tail] = splitHead(text);
    try {
      const headP = fetchTTS(head, ctrl.signal);
      const tailP = tail ? fetchTTS(tail, ctrl.signal) : null;
      if (tailP) tailP.catch(() => {});
      const headBlob = await headP;
      if (seq !== speakSeq) return;
      if ((await playBlob(headBlob, seq)) === "blocked") { browserSpeak(text); return; }
      if (seq !== speakSeq || !tailP) return;
      const tailBlob = await tailP;
      if (seq !== speakSeq) return;
      await playBlob(tailBlob, seq);
    } catch {
      if (seq === speakSeq && !ctrl.signal.aborted) browserSpeak(text);
    }
  }

  return { speak, stop };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/tts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/tts.ts frontend/lib/tts.test.ts
git commit -m "feat(frontend): TTS speaker with head/tail streaming and browser fallback"
```

---

### Task 6: `useReadAloud` + wiring (useChat, ReadAloudSwitch, SideNav, ChatShell)

**Files:**
- Create: `frontend/lib/useReadAloud.ts`, `frontend/lib/useReadAloud.test.tsx`
- Modify: `frontend/lib/useChat.ts` (add `onReplyComplete`), `frontend/lib/useChat.test.tsx` (cover it)
- Modify: `frontend/components/ReadAloudSwitch.tsx` (controlled), `frontend/components/ReadAloudSwitch.test.tsx` (new)
- Modify: `frontend/components/SideNav.tsx`, `frontend/components/ChatShell.tsx`

**Interfaces:**
- Consumes: `createSpeaker` (Task 5), `loadReadAloud`/`saveReadAloud` (Task 4), `toSpeechText` (Task 4).
- Produces: `useReadAloud(): { on: boolean; toggle(): void; speakReply(text: string): void }`. `speakReply` speaks only when `on`; toggling off calls `speaker.stop()`.
- Changes: `useChat(opts?: { onReplyComplete?: (spokenText: string) => void })` calls `onReplyComplete(toSpeechText(res.full))` after a successful reply (not on 429/413/error). `ReadAloudSwitch` becomes `<ReadAloudSwitch checked onChange />`. `SideNav` gains `readAloud={{ on, toggle }}`.

- [ ] **Step 1: Write `frontend/lib/useReadAloud.test.tsx`**
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const speak = vi.fn();
const stop = vi.fn();
vi.mock("./tts", () => ({ createSpeaker: () => ({ speak, stop }) }));

import { useReadAloud } from "./useReadAloud";

beforeEach(() => { localStorage.clear(); speak.mockClear(); stop.mockClear(); });

describe("useReadAloud", () => {
  it("is off by default and does not speak", () => {
    const { result } = renderHook(() => useReadAloud());
    act(() => result.current.speakReply("hello"));
    expect(speak).not.toHaveBeenCalled();
  });
  it("speaks replies once turned on, and stops when turned off", () => {
    const { result } = renderHook(() => useReadAloud());
    act(() => result.current.toggle());
    expect(result.current.on).toBe(true);
    expect(localStorage.getItem("np-readaloud")).toBe("1");
    act(() => result.current.speakReply("hello"));
    expect(speak).toHaveBeenCalledWith("hello");
    act(() => result.current.toggle());
    expect(stop).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/useReadAloud.test.tsx`
Expected: FAIL — cannot find module `./useReadAloud`.

- [ ] **Step 3: Write `frontend/lib/useReadAloud.ts`**
```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSpeaker, type Speaker } from "./tts";
import { loadReadAloud, saveReadAloud } from "./storage";

export function useReadAloud() {
  const [on, setOn] = useState(false);
  const speaker = useRef<Speaker | null>(null);
  if (speaker.current === null) speaker.current = createSpeaker();

  useEffect(() => { setOn(loadReadAloud()); }, []);
  useEffect(() => () => speaker.current?.stop(), []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      saveReadAloud(next);
      if (!next) speaker.current?.stop();
      return next;
    });
  }, []);

  const speakReply = useCallback((text: string) => {
    if (on) speaker.current?.speak(text);
  }, [on]);

  return { on, toggle, speakReply };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/useReadAloud.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the `onReplyComplete` hook point to `useChat`**

In `frontend/lib/useChat.ts`, change the signature and call the callback after a successful reply. Replace:
```ts
export function useChat() {
```
with:
```ts
export function useChat(opts?: { onReplyComplete?: (spokenText: string) => void }) {
```
and, in `send`, immediately after `saveHistory(history.current);` add:
```ts
        opts?.onReplyComplete?.(toSpeechText(res.full));
```
Add `toSpeechText` to the existing markdown import at the top of the file:
```ts
import { renderMarkdown, stripDisclaimer, stripGuideTokens, extractGuideSlugs, esc, toSpeechText } from "./markdown";
```

- [ ] **Step 6: Cover it in `frontend/lib/useChat.test.tsx`** — add:
```tsx
it("calls onReplyComplete with the spoken text after a successful reply", async () => {
  globalThis.fetch = vi.fn().mockResolvedValue(streamResponse("Take **magnesium**. [[guide:better-sleep]]"));
  const onReplyComplete = vi.fn();
  const { result } = renderHook(() => useChat({ onReplyComplete }));
  await act(async () => { await result.current.send("hi"); });
  await waitFor(() => expect(onReplyComplete).toHaveBeenCalledWith("Take magnesium."));
});
```

- [ ] **Step 7: Make `ReadAloudSwitch` controlled** — replace `frontend/components/ReadAloudSwitch.tsx`:
```tsx
"use client";
export function ReadAloudSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange} className="switch-row">
      <span>Read answers aloud</span>
      <span className={"switch" + (checked ? " on" : "")} aria-hidden="true">
        <span className="knob" />
      </span>
    </button>
  );
}
```
Create `frontend/components/ReadAloudSwitch.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadAloudSwitch } from "./ReadAloudSwitch";

describe("ReadAloudSwitch", () => {
  it("reflects checked and fires onChange", async () => {
    const onChange = vi.fn();
    render(<ReadAloudSwitch checked={false} onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: /read answers aloud/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: Thread read-aloud through `SideNav` and `ChatShell`**

In `frontend/components/SideNav.tsx`, add a `readAloud` prop and pass it to the switch. Change the props type to add:
```ts
  readAloud: { on: boolean; toggle: () => void };
```
and replace `<ReadAloudSwitch />` with:
```tsx
<ReadAloudSwitch checked={readAloud.on} onChange={readAloud.toggle} />
```

In `frontend/components/ChatShell.tsx`, wire the hook. Replace the hook lines:
```tsx
  const { messages, busy, started, send, newChat } = useChat();
  const [drawer, setDrawer] = useState(false);
```
with:
```tsx
  const readAloud = useReadAloud();
  const { messages, busy, started, send, newChat } = useChat({ onReplyComplete: readAloud.speakReply });
  const [drawer, setDrawer] = useState(false);
```
add the import:
```tsx
import { useReadAloud } from "@/lib/useReadAloud";
```
and pass the prop to `<SideNav ... readAloud={readAloud} />`.

- [ ] **Step 9: Run the affected tests + build**

Run: `cd frontend && npx vitest run lib/useReadAloud.test.tsx lib/useChat.test.tsx components/ReadAloudSwitch.test.tsx && npm run build`
Expected: PASS; build clean.

- [ ] **Step 10: Commit**
```bash
git add frontend/lib/useReadAloud.ts frontend/lib/useReadAloud.test.tsx frontend/lib/useChat.ts frontend/lib/useChat.test.tsx frontend/components/ReadAloudSwitch.tsx frontend/components/ReadAloudSwitch.test.tsx frontend/components/SideNav.tsx frontend/components/ChatShell.tsx
git commit -m "feat(frontend): read-aloud that speaks completed replies from the rail/drawer switch"
```

---

### Task 7: `useDictation` + composer mic

**Files:**
- Create: `frontend/lib/useDictation.ts`, `frontend/lib/useDictation.test.tsx`
- Modify: `frontend/components/Composer.tsx`, `frontend/components/Composer.test.tsx`
- Modify: `frontend/app/globals.css` (mic recording state)

**Interfaces:**
- Consumes: `sharedMic` (Task 1).
- Produces: `useDictation(onText: (t: string) => void): { supported: boolean; listening: boolean; processing: boolean; toggle(): Promise<void> }`. First `toggle` opens the mic and records (`sharedMic.capturing = true`, `sink` accumulates frames); second `toggle` stops, concatenates the Int16 frames, and if ≥ `16000 * 0.3` samples POSTs the PCM to `/api/stt`, calling `onText` with the transcript. It never opens a voice call.
- Change: `Composer` renders the mic **enabled** (when supported), toggling dictation; appends transcribed text to the textarea; shows a "Working out what you said…" placeholder while `processing`; adds a `recording` class while `listening`.

- [ ] **Step 1: Write `frontend/lib/useDictation.test.tsx`**
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mic = {
  capturing: false,
  sink: null as ((f: Int16Array) => void) | null,
  open: vi.fn().mockResolvedValue(true),
  close: vi.fn(),
  errMessage: () => "err",
};
vi.mock("./mic", () => ({ sharedMic: mic }));

import { useDictation } from "./useDictation";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });
beforeEach(() => { mic.capturing = false; mic.sink = null; mic.open.mockClear(); mic.close.mockClear(); });

describe("useDictation", () => {
  it("records then transcribes to onText on the second toggle", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "hello world" }), { status: 200 }));
    const onText = vi.fn();
    const { result } = renderHook(() => useDictation(onText));
    await act(async () => { await result.current.toggle(); }); // start
    expect(mic.open).toHaveBeenCalled();
    expect(result.current.listening).toBe(true);
    // feed ~0.5s of audio through the sink the hook installed
    act(() => { mic.sink?.(new Int16Array(8000)); });
    await act(async () => { await result.current.toggle(); }); // stop
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/stt", expect.objectContaining({ method: "POST" }));
    expect(onText).toHaveBeenCalledWith("hello world");
    expect(result.current.listening).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/useDictation.test.tsx`
Expected: FAIL — cannot find module `./useDictation`.

- [ ] **Step 3: Write `frontend/lib/useDictation.ts`**
```ts
"use client";
import { useCallback, useRef, useState } from "react";
import { sharedMic } from "./mic";

const MIN_SAMPLES = 16000 * 0.3;

export function useDictation(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const chunks = useRef<Int16Array[]>([]);
  const supported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

  const toggle = useCallback(async () => {
    if (listening) {
      setListening(false);
      sharedMic.capturing = false;
      sharedMic.sink = null;
      const total = chunks.current.reduce((a, c) => a + c.length, 0);
      const pcm = new Int16Array(total);
      let o = 0;
      for (const c of chunks.current) { pcm.set(c, o); o += c.length; }
      chunks.current = [];
      if (pcm.length >= MIN_SAMPLES) {
        setProcessing(true);
        try {
          const res = await fetch("/api/stt", {
            method: "POST",
            headers: { "content-type": "application/octet-stream" },
            body: pcm.buffer,
          });
          if (res.ok) {
            const t = ((await res.json()).text || "").trim();
            if (t) onText(t);
          }
        } catch { /* ignore; leave the box unchanged */ }
        setProcessing(false);
      }
      return;
    }
    const ok = await sharedMic.open();
    if (!ok) return;
    chunks.current = [];
    sharedMic.sink = (f) => chunks.current.push(f);
    sharedMic.capturing = true;
    setListening(true);
  }, [listening, onText]);

  return { supported, listening, processing, toggle };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/useDictation.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the mic into `Composer`**

In `frontend/components/Composer.tsx`: import and use the hook, append transcript to the box, and enable the mic button. Add near the top of the component body:
```tsx
  const dictation = useDictation((t) => setValue((v) => (v.trim() ? v.trim() + " " + t : t)));
```
add the import:
```tsx
import { useDictation } from "@/lib/useDictation";
```
Replace the disabled mic button with:
```tsx
        {dictation.supported && (
          <button
            className={"pill-btn mic" + (dictation.listening ? " recording" : "")}
            type="button"
            aria-label={dictation.listening ? "Stop dictation" : "Speak your question"}
            aria-pressed={dictation.listening}
            onClick={() => void dictation.toggle()}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <line x1="12" y1="18" x2="12" y2="21" />
            </svg>
          </button>
        )}
```
Change the textarea placeholder to reflect processing:
```tsx
          placeholder={dictation.processing ? "Working out what you said…" : "Ask the professor…"}
```

- [ ] **Step 6: Update `frontend/components/Composer.test.tsx`** — the existing two tests still hold (the mic renders enabled now). Add:
```tsx
it("renders an enabled dictation mic", () => {
  render(<Composer busy={false} onSend={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Speak your question" })).toBeEnabled();
});
```
(Ensure `vi` is imported in the test file.)

- [ ] **Step 7: Add the recording style** — append to `frontend/app/globals.css` inside a `@layer components` block, plus a keyframe and reduced-motion guard:
```css
@layer components {
  .mic.recording{background:var(--color-danger); color:#fff; border-color:transparent; animation:record-pulse 1.6s infinite}
}
@keyframes record-pulse{0%,100%{box-shadow:0 0 0 0 rgba(229,72,77,.42)}50%{box-shadow:0 0 0 6px rgba(229,72,77,0)}}
@media (prefers-reduced-motion:reduce){ .mic.recording{animation:none} }
```

- [ ] **Step 8: Run the full suite + typecheck + build**

Run: `cd frontend && npm run test:run && npm run typecheck && npm run build`
Expected: all pass; build clean.

- [ ] **Step 9: Commit**
```bash
git add frontend/lib/useDictation.ts frontend/lib/useDictation.test.tsx frontend/components/Composer.tsx frontend/components/Composer.test.tsx frontend/app/globals.css
git commit -m "feat(frontend): composer dictation mic (speech-to-text)"
```

---

## Self-review — spec coverage (Phase 2 scope)

- Shared 16 kHz mic + DSP (spec §6 `mic.ts`): Task 1. ✓
- `/api/tts`, `/api/stt` BFF (spec §6, §8; CHAT_VOICE_MODES §2.3/§8): Tasks 2, 3. ✓
- Read-aloud pref + reply→speech text (spec §9; CHAT_VOICE_MODES §2.3): Task 4. ✓
- TTS speaker with head/tail streaming + browser fallback (spec §6 `tts.ts`): Task 5. ✓
- `useReadAloud`, switch in drawer/rail, speaks completed replies (spec §6, §8; CHAT_VOICE_MODES §2.3): Task 6. ✓
- `useDictation` + composer mic, ≥0.3s gate, never opens a call (spec §6, §8; CHAT_VOICE_MODES §8): Task 7. ✓
- Testing (spec §13): pure DSP, splitHead, toSpeechText, both BFF routes, useReadAloud, useDictation stop→stt→onText, controlled switch, enabled mic — all covered by Vitest. WebAudio playback/capture stays manual (documented).

**Type consistency:** `createSpeaker(): Speaker {speak,stop}` used by `useReadAloud`; `sharedMic {open,close,capturing,sink,errMessage}` used by `useDictation` and reused in Phase 3; `useChat({onReplyComplete})` optional param keeps Phase-1 call sites (`useChat()`) valid; `ReadAloudSwitch {checked,onChange}` matches the `SideNav`/`ChatShell` wiring.

**Deferred to Phase 3 (named seams, not placeholders):** the `sharedMic` is reused by `useVoiceCall`; the composer's morphing key `onCall` is still wired in Phase 3; dictation's "must not run while a call is open" guard becomes live once the call exists.

## Manual verification (needs the backend authenticated)

With ADC set on the backend: toggle **Read answers aloud** in the rail → send a message → the reply is spoken (server voice, or the browser voice if `/tts` errors). Tap the composer **mic** → speak → text appears in the box. Both must work at mobile and `lg`, and never open a voice stage.
