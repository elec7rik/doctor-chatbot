import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});
beforeEach(() => {
  process.env.BACKEND_URL = "http://backend.test";
});

function req(body: unknown) {
  return new Request("http://localhost/api/chat/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat/stream", () => {
  it("400s an invalid body", async () => {
    const res = await POST(req({ message: "" }));
    expect(res.status).toBe(400);
  });
  it("forwards to the backend and propagates X-Session-Id", async () => {
    const upstream = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("hi"));
          c.close();
        },
      }),
      { status: 200, headers: { "X-Session-Id": "sid-9", "content-type": "text/plain" } },
    );
    globalThis.fetch = vi.fn().mockResolvedValue(upstream);
    const res = await POST(req({ message: "hello" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Session-Id")).toBe("sid-9");
    expect(await res.text()).toBe("hi");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://backend.test/chat/stream",
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("maps a 429 through", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("slow down", { status: 429 }));
    const res = await POST(req({ message: "hello" }));
    expect(res.status).toBe(429);
  });
});
