import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PointerEvent as RPointerEvent } from "react";

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

const socket = vi.hoisted(() => ({ readyState: 1, send: vi.fn(), sendPCM: vi.fn(), close: vi.fn(), handlers: undefined as unknown }));
const createLiveSocketSpy = vi.hoisted(() => vi.fn());
vi.mock("./liveSocket", () => ({
  createLiveSocket: (url: string, handlers: unknown) => { createLiveSocketSpy(url, handlers); socket.handlers = handlers; return socket; },
  liveUrl: () => "ws://test/live",
}));

import { useVoiceCall } from "./useVoiceCall";
type Handlers = { onOpen?: () => void; onMessage?: (m: unknown) => void; onClose?: () => void; onAudio?: (b: ArrayBuffer) => void };
const handlers = () => socket.handlers as Handlers;

beforeEach(() => {
  localStorage.clear();
  mic.open.mockClear(); mic.close.mockClear(); mic.flushOutput.mockClear();
  socket.send.mockClear(); socket.close.mockClear(); createLiveSocketSpy.mockClear();
  window.history.pushState = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("useVoiceCall", () => {
  it("startCall opens the mic and socket; READY moves to idle", async () => {
    const { result } = renderHook(() => useVoiceCall({ threadLen: 0 }));
    await act(async () => { await result.current.startCall(); });
    expect(result.current.active).toBe(true);
    expect(mic.open).toHaveBeenCalled();
    expect(createLiveSocketSpy).toHaveBeenCalled();
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
  it("drops model audio while the user is talking (barge-in), plays it otherwise", async () => {
    const { result } = renderHook(() => useVoiceCall({ threadLen: 0 }));
    await act(async () => { await result.current.startCall(); });
    act(() => handlers().onMessage?.({ type: "ready" }));
    mic.play24k.mockClear();
    // user is holding to talk: incoming model audio must NOT play over them
    mic.capturing = true;
    act(() => handlers().onAudio?.(new Int16Array(2).buffer));
    expect(mic.play24k).not.toHaveBeenCalled();
    // user released: model audio for the answer plays again
    mic.capturing = false;
    act(() => handlers().onAudio?.(new Int16Array(2).buffer));
    expect(mic.play24k).toHaveBeenCalledTimes(1);
  });
  it("keeps the old answer's leftover audio muted after a barge-in until the turn boundary", async () => {
    const raf = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(0 as unknown as number);
    const caf = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    let t = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => t);
    const ev = () => ({ preventDefault() {}, currentTarget: { setPointerCapture() {} }, pointerId: 1 }) as unknown as RPointerEvent<HTMLButtonElement>;

    const { result } = renderHook(() => useVoiceCall({ threadLen: 0 }));
    await act(async () => { await result.current.startCall(); });
    act(() => handlers().onMessage?.({ type: "ready" }));            // idle
    // first turn: press-hold-release -> thinking (no barge, bargedRef stays false)
    t = 0;    act(() => result.current.onPointerDown(ev()));         // idle -> listening
    t = 500;  act(() => result.current.onPointerUp(ev()));           // hold -> thinking
    // barge in on the in-flight answer: press-hold-release
    t = 600;  act(() => result.current.onPointerDown(ev()));         // thinking -> listening (bargedRef=true)
    t = 1100; act(() => result.current.onPointerUp(ev()));           // hold -> thinking (capturing=false)
    mic.capturing = false;
    mic.play24k.mockClear();
    // leftover answer-1 frames arrive AFTER release — must still be muted
    act(() => handlers().onAudio?.(new Int16Array(2).buffer));
    expect(mic.play24k).not.toHaveBeenCalled();
    // server marks the boundary — the new answer is allowed through
    act(() => handlers().onMessage?.({ type: "interrupted" }));
    act(() => handlers().onAudio?.(new Int16Array(2).buffer));
    expect(mic.play24k).toHaveBeenCalledTimes(1);

    nowSpy.mockRestore(); raf.mockRestore(); caf.mockRestore();
  });
});
