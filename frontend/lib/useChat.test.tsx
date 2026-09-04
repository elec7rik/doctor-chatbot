import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "./useChat";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});
beforeEach(() => localStorage.clear());

function streamResponse(text: string, sid = "s1") {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(text));
        c.close();
      },
    }),
    { status: 200, headers: { "X-Session-Id": sid } },
  );
}

describe("useChat", () => {
  it("adds a user bubble then streams a bot reply with a guide card", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse("Sleep is **key**. [[guide:better-sleep]]"));
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.send("how do I sleep?");
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[0]).toMatchObject({ role: "user" });
    const bot = result.current.messages[1]!;
    expect(bot.role).toBe("bot");
    expect(bot.html).toContain("<strong>key</strong>");
    expect(bot.guideSlugs).toEqual(["better-sleep"]);
    expect(localStorage.getItem("np-session")).toBe("s1");
  });
  it("shows an apology bubble when the request throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useChat());
    await act(async () => {
      await result.current.send("hi");
    });
    await waitFor(() => expect(result.current.messages.at(-1)!.html).toMatch(/couldn.t reach the professor/i));
  });
  it("calls onReplyComplete with the spoken text after a successful reply", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse("Take **magnesium**. [[guide:better-sleep]]"));
    const onReplyComplete = vi.fn();
    const { result } = renderHook(() => useChat({ onReplyComplete }));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => expect(onReplyComplete).toHaveBeenCalledWith("Take magnesium."));
  });
});
