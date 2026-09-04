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
