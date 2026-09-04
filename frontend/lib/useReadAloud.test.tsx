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
