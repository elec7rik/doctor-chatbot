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
