from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel

from . import live, ratelimit, sessions, stt, tts
from .agent import process_message, stream_message
from .sanitize import sanitize_stream
from .config import settings

app = FastAPI(title="My Longevity Hub — Nutty Professor API")

STATIC = Path(__file__).parent / "static"


def _client_ip(request: Request) -> str:
    # Behind Cloud Run's front end the real client is the first hop in XFF.
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


class Turn(BaseModel):
    role: str
    text: str


class ChatIn(BaseModel):
    message: str
    session_id: str | None = None
    history: list[Turn] | None = None   # client-sent transcript → stateless server


class ChatOut(BaseModel):
    session_id: str
    reply: str


def _sanitise_history(turns: list[Turn]) -> list[dict]:
    clean: list[dict] = []
    for t in turns[-settings.MAX_HISTORY_TURNS:]:
        text = (t.text or "").strip()[: settings.MAX_TURN_CHARS]
        if text:
            clean.append({"role": "model" if t.role == "model" else "user", "text": text})
    return clean


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": settings.GEMINI_MODEL,
        "project": settings.GCP_PROJECT_ID,
        "region": settings.GCP_REGION,
    }


@app.post("/chat", response_model=ChatOut)
def chat(body: ChatIn, request: Request):
    if not ratelimit.allow(_client_ip(request)):
        raise HTTPException(status_code=429, detail="Too many messages — please slow down for a moment.")

    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is empty.")
    if len(message) > settings.MAX_MESSAGE_CHARS:
        raise HTTPException(status_code=413, detail="That message is a bit long — please shorten it.")

    sid = body.session_id or sessions.new_session_id()

    if body.history is not None:
        # Stateless path: the browser keeps the transcript and sends it back, so
        # any instance can serve any request (scales past a single instance).
        history = _sanitise_history(body.history)
        result = process_message(history, message)
    else:
        # Legacy path: server holds history in memory (single-instance only).
        history = sessions.get_history(sid)
        result = process_message(history, message)
        sessions.append(sid, "user", message)
        sessions.append(sid, "model", result["reply"])

    return ChatOut(session_id=sid, reply=result["reply"])


@app.post("/chat/stream")
def chat_stream(body: ChatIn, request: Request):
    """Same contract as /chat, but streams the reply text as it is generated.
    The session id is returned in the X-Session-Id response header; the body is
    the plain-text reply, flushed in chunks."""
    if not ratelimit.allow(_client_ip(request)):
        raise HTTPException(status_code=429, detail="Too many messages — please slow down for a moment.")

    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is empty.")
    if len(message) > settings.MAX_MESSAGE_CHARS:
        raise HTTPException(status_code=413, detail="That message is a bit long — please shorten it.")

    sid = body.session_id or sessions.new_session_id()
    stateless = body.history is not None
    history = _sanitise_history(body.history) if stateless else sessions.get_history(sid)

    def generate():
        collected: list[str] = []
        for piece in sanitize_stream(stream_message(history, message)):
            collected.append(piece)
            yield piece
        if not stateless:  # legacy in-memory path keeps its own transcript
            full = "".join(collected)
            sessions.append(sid, "user", message)
            sessions.append(sid, "model", full)

    return StreamingResponse(
        generate(),
        media_type="text/plain; charset=utf-8",
        headers={
            "X-Session-Id": sid,
            "X-Accel-Buffering": "no",   # ask any proxy not to buffer the stream
            "Cache-Control": "no-cache",
        },
    )


class TTSIn(BaseModel):
    text: str


@app.post("/tts")
def text_to_speech(body: TTSIn, request: Request):
    """Synthesise speech for a reply. Non-200 tells the UI to fall back to the
    browser voice, so a TTS hiccup never breaks read-aloud."""
    if not ratelimit.allow(_client_ip(request)):
        return Response(content="rate_limited", status_code=429, media_type="text/plain")
    try:
        audio = tts.synthesize(body.text)
    except Exception as e:  # noqa: BLE001 — surface as a clean 502 for the client
        return Response(content=str(e)[:300], status_code=502, media_type="text/plain")
    return Response(content=audio, media_type=tts.media_type())


@app.post("/stt")
async def speech_to_text(request: Request):
    """Body: raw 16 kHz 16-bit mono PCM (a hold-to-talk clip). Returns {text}."""
    if not ratelimit.allow(_client_ip(request)):
        return Response(content="rate_limited", status_code=429, media_type="text/plain")
    pcm = await request.body()
    if len(pcm) > stt.MAX_BYTES:
        return Response(content="too_long", status_code=413, media_type="text/plain")
    try:
        text = await run_in_threadpool(stt.transcribe, pcm)
    except Exception as e:  # noqa: BLE001 — surface upstream failures as 502
        return Response(content=str(e)[:300], status_code=502, media_type="text/plain")
    return {"text": text}


def _client_ip_ws(ws: WebSocket) -> str:
    xff = ws.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return ws.client.host if ws.client else "unknown"


@app.websocket("/live")
async def live_call(ws: WebSocket):
    """Hold-to-talk voice call with the professor (native-audio Live model)."""
    await ws.accept()
    if not ratelimit.allow(_client_ip_ws(ws)):
        import json as _json
        await ws.send_text(_json.dumps({"type": "error", "text": "rate_limited"}))
        await ws.close()
        return
    await live.relay(ws)
