import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mic = vi.hoisted(() => ({
  capturing: false,
  sink: null as ((f: Int16Array) => void) | null,
  open: vi.fn().mockResolvedValue(true),
  close: vi.fn(),
  errMessage: () => "err",
}));
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
