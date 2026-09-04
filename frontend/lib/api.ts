import type { ChatRequest } from "./schemas";

export interface StreamResult {
  sessionId: string | null;
  full: string;
  status: number;
}

export async function streamChat(
  body: ChatRequest,
  onChunk: (full: string) => void,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 429 || res.status === 413) {
    return { sessionId: null, full: "", status: res.status };
  }
  if (!res.ok || !res.body) throw new Error("HTTP " + res.status);

  const sessionId = res.headers.get("X-Session-Id");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
    onChunk(full);
  }
  full += dec.decode();
  onChunk(full);
  return { sessionId, full, status: 200 };
}
