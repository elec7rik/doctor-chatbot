import { ChatRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendUrl(): string {
  return process.env.BACKEND_URL ?? "http://localhost:8000";
}

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(json);
  if (!parsed.success) return new Response("Invalid request", { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(text, { status: upstream.status || 502 });
  }

  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
    "cache-control": "no-cache",
    "x-accel-buffering": "no",
  });
  const sid = upstream.headers.get("X-Session-Id");
  if (sid) headers.set("X-Session-Id", sid);

  // Pump the upstream stream manually rather than returning `upstream.body`
  // directly: piping an undici response body straight into a Next Response can
  // throw "failed to pipe response / terminated" on the Node runtime.
  const reader = upstream.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });

  return new Response(stream, { status: 200, headers });
}
