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

/** Convert a 16-bit PCM ArrayBuffer to normalised Float32 samples. */
export function pcm16ToFloat32(buf: ArrayBuffer): Float32Array {
  const i16 = new Int16Array(buf);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i]! / 32768;
  return f32;
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
  private playHead = 0;
  private sources = new Set<AudioBufferSourceNode>();

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

  close(): void {
    this.flushOutput();
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
