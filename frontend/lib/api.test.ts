import { describe, it, expect, vi, afterEach } from "vitest";
import { streamChat } from "./api";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function streamResponse(chunks: string[], headers: Record<string, string> = {}, status = 200) {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    }),
    { status, headers },
  );
}

describe("streamChat", () => {
  it("accumulates chunks and returns the session id", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse(["Hel", "lo"], { "X-Session-Id": "s1" }));
    const seen: string[] = [];
    const res = await streamChat({ message: "hi" }, (full) => seen.push(full));
    expect(res.full).toBe("Hello");
    expect(res.sessionId).toBe("s1");
    expect(seen.at(-1)).toBe("Hello");
  });
  it("returns status without throwing on 429", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse([], {}, 429));
    const res = await streamChat({ message: "hi" }, () => {});
    expect(res.status).toBe(429);
    expect(res.full).toBe("");
  });
});
