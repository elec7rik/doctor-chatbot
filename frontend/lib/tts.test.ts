import { describe, it, expect, vi, afterEach } from "vitest";
import { splitHead, fetchTTS } from "./tts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

describe("splitHead", () => {
  it("returns a short text as a single head", () => {
    expect(splitHead("Short and sweet.")).toEqual(["Short and sweet.", ""]);
  });
  it("splits a long text into an opener and a tail", () => {
    const long = "First sentence here that is reasonably long. " + "Second follows on. ".repeat(10);
    const [head, tail] = splitHead(long);
    expect(head.length).toBeGreaterThan(0);
    expect(tail.length).toBeGreaterThan(0);
    expect((head + " " + tail).replace(/\s+/g, " ").trim()).toBe(long.replace(/\s+/g, " ").trim());
  });
});

describe("fetchTTS", () => {
  it("POSTs the text to /api/tts and returns a blob", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { status: 200, headers: { "content-type": "audio/mpeg" } }));
    const blob = await fetchTTS("hi");
    expect(blob).toBeInstanceOf(Blob);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/tts", expect.objectContaining({ method: "POST" }));
  });
  it("throws on a non-200 so the caller can fall back", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 502 }));
    await expect(fetchTTS("hi")).rejects.toThrow();
  });
});
