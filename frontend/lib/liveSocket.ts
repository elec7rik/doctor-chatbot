import { LiveMessageSchema, type LiveMessage } from "./schemas";

export function liveUrl(env: string | undefined, loc: { protocol: string; host: string }): string {
  if (env) return env;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/live`;
}

export interface LiveHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onAudio?: (buf: ArrayBuffer) => void;
  onMessage?: (m: LiveMessage) => void;
}

export interface LiveSocket {
  readonly readyState: number;
  send(m: { type: "start" } | { type: "end" }): void;
  sendPCM(frame: Int16Array): void;
  close(): void;
}

export function createLiveSocket(url: string, handlers: LiveHandlers, WS: typeof WebSocket = WebSocket): LiveSocket {
  const ws = new WS(url);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => handlers.onOpen?.();
  ws.onclose = () => handlers.onClose?.();
  ws.onerror = () => { /* surfaced via onclose */ };
  ws.onmessage = (ev: MessageEvent) => {
    if (typeof ev.data !== "string") { handlers.onAudio?.(ev.data as ArrayBuffer); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(ev.data); } catch { return; }
    const res = LiveMessageSchema.safeParse(parsed);
    if (res.success) handlers.onMessage?.(res.data);
  };
  return {
    get readyState() { return ws.readyState; },
    send(m) { try { ws.send(JSON.stringify(m)); } catch { /* ignore */ } },
    sendPCM(frame) { try { if (ws.readyState === 1) ws.send(frame.buffer as ArrayBuffer); } catch { /* ignore */ } },
    close() { try { ws.close(); } catch { /* ignore */ } },
  };
}
