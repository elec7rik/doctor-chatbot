export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendUrl(): string {
  return process.env.BACKEND_URL ?? "http://localhost:8000";
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.arrayBuffer();
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl()}/stt`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body,
    });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }
  const text = await upstream.text().catch(() => "");
  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
