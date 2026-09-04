import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ text: z.string().min(1).max(4000) });
function backendUrl(): string {
  return process.env.BACKEND_URL ?? "http://localhost:8000";
}

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try { json = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return new Response("Invalid request", { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(await upstream.text().catch(() => ""), { status: upstream.status || 502 });
  }
  const buf = await upstream.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: { "content-type": upstream.headers.get("content-type") ?? "audio/mpeg", "cache-control": "no-store" },
  });
}
