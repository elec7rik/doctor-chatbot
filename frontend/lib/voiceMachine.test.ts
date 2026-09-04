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
