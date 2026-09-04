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
