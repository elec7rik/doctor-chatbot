import { describe, it, expect, vi } from "vitest";
import { liveUrl, createLiveSocket } from "./liveSocket";

describe("liveUrl", () => {
  it("prefers the explicit env URL", () => {
    expect(liveUrl("ws://localhost:8000/live", { protocol: "https:", host: "x" })).toBe("ws://localhost:8000/live");
  });
  it("falls back to same-origin wss/ws by page protocol", () => {
    expect(liveUrl(undefined, { protocol: "https:", host: "app.co" })).toBe("wss://app.co/live");
    expect(liveUrl("", { protocol: "http:", host: "localhost:3000" })).toBe("ws://localhost:3000/live");
  });
});

class FakeWS {
  static OPEN = 1;
  url: string;
  binaryType = "";
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  sent: unknown[] = [];
  constructor(url: string) { this.url = url; }
  send(d: unknown) { this.sent.push(d); }
  close() { this.readyState = 3; this.onclose?.(); }
}

function make() {
  const handlers = { onOpen: vi.fn(), onClose: vi.fn(), onAudio: vi.fn(), onMessage: vi.fn() };
  let ws!: FakeWS;
  const WS = vi.fn().mockImplementation(function (url: string) { ws = new FakeWS(url); return ws; }) as unknown as typeof WebSocket;
  const sock = createLiveSocket("ws://x/live", handlers, WS);
  return { sock, handlers, get ws() { return ws; } };
}

describe("createLiveSocket", () => {
  it("routes a valid JSON frame to onMessage and drops invalid ones", () => {
    const t = make();
    t.ws.onmessage!({ data: JSON.stringify({ type: "ready" }) });
    t.ws.onmessage!({ data: JSON.stringify({ type: "bogus" }) });
    t.ws.onmessage!({ data: "not json" });
    expect(t.handlers.onMessage).toHaveBeenCalledTimes(1);
    expect(t.handlers.onMessage).toHaveBeenCalledWith({ type: "ready" });
  });
  it("routes a binary frame to onAudio", () => {
    const t = make();
    const buf = new ArrayBuffer(8);
    t.ws.onmessage!({ data: buf });
    expect(t.handlers.onAudio).toHaveBeenCalledWith(buf);
  });
  it("send() serialises control messages; sendPCM sends the frame buffer", () => {
    const t = make();
    t.sock.send({ type: "start" });
    t.sock.sendPCM(new Int16Array([1, 2, 3]));
    expect(t.ws.sent[0]).toBe(JSON.stringify({ type: "start" }));
    expect(t.ws.sent[1]).toBeInstanceOf(ArrayBuffer);
  });
});
