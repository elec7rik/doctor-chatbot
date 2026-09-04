import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });
beforeEach(() => { process.env.BACKEND_URL = "http://backend.test"; });

function req(body: unknown) {
  return new Request("http://localhost/api/tts", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/tts", () => {
  it("400s an empty text", async () => {
    expect((await POST(req({ text: "" }))).status).toBe(400);
  });
  it("returns audio bytes with the upstream content-type", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(bytes, { status: 200, headers: { "content-type": "audio/mpeg" } }));
    const res = await POST(req({ text: "hello" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    expect(globalThis.fetch).toHaveBeenCalledWith("http://backend.test/tts", expect.objectContaining({ method: "POST" }));
  });
  it("passes a 502 through so the client can fall back", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("boom", { status: 502 }));
    expect((await POST(req({ text: "hello" }))).status).toBe(502);
  });
});
