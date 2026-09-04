import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });
beforeEach(() => { process.env.BACKEND_URL = "http://backend.test"; });

function req(bytes: Uint8Array) {
  return new Request("http://localhost/api/stt", {
    method: "POST", headers: { "content-type": "application/octet-stream" }, body: bytes,
  });
}

describe("POST /api/stt", () => {
  it("forwards the PCM body and returns the transcript", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "hello there" }), { status: 200, headers: { "content-type": "application/json" } }));
    const res = await POST(req(new Uint8Array([1, 2, 3, 4])));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "hello there" });
    expect(globalThis.fetch).toHaveBeenCalledWith("http://backend.test/stt", expect.objectContaining({ method: "POST" }));
  });
  it("passes a 413 through", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("too_long", { status: 413 }));
    expect((await POST(req(new Uint8Array([1])))).status).toBe(413);
  });
});
