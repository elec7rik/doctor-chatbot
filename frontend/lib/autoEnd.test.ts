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
