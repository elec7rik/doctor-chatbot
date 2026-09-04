"""THROWAWAY spike — 'Call the Professor' live voice harness (instrumented).

Relays browser audio <-> Gemini Live native-audio session, runs the real
check_emergency guardrail on the live input transcription, and reports
timing at every boundary so we can see where latency is spent:

  browser mic -> [ws] -> this server -> [ws] -> Gemini -> [ws] -> server -> [ws] -> browser speaker

Modes (query param on /ws):
  ?mode=vad  Gemini's automatic voice-activity detection decides turn ends (default)
  ?mode=ptt  push-to-talk: browser sends activity_start / activity_end explicitly

Run:  PYTHONUNBUFFERED=1 backend/.venv/bin/uvicorn server:app --app-dir spike --host 127.0.0.1 --port 8100
Open: http://localhost:8100
"""
import asyncio
import json
import pathlib
import subprocess
import sys
import time

from fastapi import FastAPI, WebSocket
from fastapi.responses import FileResponse
from google import genai
from google.genai import types
from google.oauth2.credentials import Credentials

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "backend"))
from app.guardrails import check_emergency  # reuse the REAL deterministic guardrail

PROJECT = "doctor-chatbot-507406"
LOCATION = "europe-west4"
MODEL = "gemini-live-2.5-flash-native-audio"
IN_BYTES_PER_SEC = 16000 * 2  # 16 kHz, 16-bit mono

SYSTEM = (
    "You are The Nutty Professor, a warm, plain-speaking UK health-and-longevity educator. "
    "You are NOT a doctor and never give medical advice or dosing. Keep replies short and "
    "conversational (1-2 sentences) — this is a voice call. If someone describes a medical "
    "emergency (chest pain, trouble breathing, stroke signs, self-harm), tell them to call 999 "
    "or NHS 111 immediately. Research peptides are research-use-only in the UK; never tell anyone to take them."
)


def make_config(mode: str) -> types.LiveConnectConfig:
    if mode == "ptt":
        vad = types.AutomaticActivityDetection(disabled=True)
    else:
        vad = types.AutomaticActivityDetection(
            start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
            end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
            silence_duration_ms=300,
        )
    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Charon")
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(automatic_activity_detection=vad),
        system_instruction=SYSTEM,
    )


def token() -> str:
    return subprocess.run(
        ["gcloud", "auth", "print-access-token", "--account=colllective57health@gmail.com"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def log(msg: str) -> None:
    print(f"{time.strftime('%H:%M:%S')} {msg}", flush=True)


app = FastAPI()


@app.get("/")
def index():
    return FileResponse(HERE / "index.html")


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    mode = ws.query_params.get("mode", "vad")
    t0 = time.perf_counter()
    client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION,
                          credentials=Credentials(token=token()))
    log(f"[conn] mode={mode} token fetched in {(time.perf_counter()-t0)*1000:.0f} ms")
    stop = asyncio.Event()
    guard = {"tripped": False}  # suppress model audio once an emergency is detected this turn

    async def send_json(obj: dict) -> None:
        await ws.send_text(json.dumps(obj))

    try:
        t1 = time.perf_counter()
        async with client.aio.live.connect(model=MODEL, config=make_config(mode)) as session:
            setup_ms = int((time.perf_counter() - t1) * 1000)
            log(f"[conn] gemini live session open in {setup_ms} ms")
            await send_json({"type": "ready", "mode": mode, "setup_ms": setup_ms})

            async def browser_to_live():
                """Forward mic audio; measure whether the upstream path keeps up with real time."""
                nbytes = 0
                first_at = None
                last_report = time.time()
                send_ms: list[float] = []
                try:
                    while not stop.is_set():
                        msg = await ws.receive()
                        if msg.get("type") == "websocket.disconnect":
                            log(f"[browser] disconnected code={msg.get('code')}")
                            break
                        if msg.get("text"):
                            m = json.loads(msg["text"])
                            if m.get("type") == "ptt":
                                if m.get("on"):
                                    await session.send_realtime_input(activity_start=types.ActivityStart())
                                else:
                                    await session.send_realtime_input(activity_end=types.ActivityEnd())
                                log(f"[ptt] {'start' if m.get('on') else 'end'}")
                            continue
                        data = msg.get("bytes")
                        if not data:
                            continue
                        now = time.time()
                        first_at = first_at or now
                        ts = time.perf_counter()
                        await session.send_realtime_input(
                            audio=types.Blob(data=data, mime_type="audio/pcm;rate=16000")
                        )
                        send_ms.append((time.perf_counter() - ts) * 1000)
                        nbytes += len(data)
                        if now - last_report >= 2:
                            audio_s = nbytes / IN_BYTES_PER_SEC
                            wall_s = now - first_at
                            rep = {
                                "type": "up",
                                "audio_s": round(audio_s, 2),
                                "wall_s": round(wall_s, 2),
                                "lag_s": round(wall_s - audio_s, 2),   # >0 and growing = upstream can't keep up
                                "send_avg_ms": round(sum(send_ms) / len(send_ms), 1),
                                "send_max_ms": round(max(send_ms), 1),  # how long server->Gemini sends block
                            }
                            log(f"[up] audio={rep['audio_s']}s wall={rep['wall_s']}s lag={rep['lag_s']}s "
                                f"send avg={rep['send_avg_ms']}ms max={rep['send_max_ms']}ms")
                            await send_json(rep)
                            send_ms.clear()
                            last_report = now
                except Exception as e:  # noqa: BLE001
                    log(f"[browser_to_live] ended: {type(e).__name__} {str(e)[:200]}")
                finally:
                    stop.set()

            async def live_to_browser():
                turns = 0
                t_last_user = None
                got_audio = False
                try:
                    # receive() yields one turn then returns; loop for the life of the session.
                    while not stop.is_set():
                        async for resp in session.receive():
                            if stop.is_set():
                                break
                            # --- non-content messages: these explain session ends and cost ---
                            if getattr(resp, "go_away", None):
                                log(f"[server] GO_AWAY {resp.go_away}")
                                await send_json({"type": "sys", "text": f"Gemini GO_AWAY: {resp.go_away}"})
                            um = getattr(resp, "usage_metadata", None)
                            if um and getattr(um, "total_token_count", None):
                                u = {"type": "usage",
                                     "prompt": um.prompt_token_count, "response": um.response_token_count,
                                     "total": um.total_token_count}
                                log(f"[usage] prompt={u['prompt']} response={u['response']} total={u['total']}")
                                await send_json(u)
                            sc = resp.server_content
                            if not sc:
                                continue
                            it = getattr(sc, "input_transcription", None)
                            if it and it.text:
                                t_last_user = t_last_user or time.time()
                                await send_json({"type": "user", "text": it.text})
                                if check_emergency(it.text):
                                    guard["tripped"] = True
                                    await send_json({"type": "guardrail"})
                            ot = getattr(sc, "output_transcription", None)
                            if ot and ot.text:
                                await send_json({"type": "bot", "text": ot.text})
                            if getattr(sc, "interrupted", None):
                                got_audio = False
                                log("[turn] interrupted (barge-in)")
                                await send_json({"type": "interrupted"})
                            mt = getattr(sc, "model_turn", None)
                            if mt and not guard["tripped"]:
                                for p in mt.parts:
                                    if getattr(p, "inline_data", None) and p.inline_data.data:
                                        if not got_audio:
                                            lat = int((time.time() - t_last_user) * 1000) if t_last_user else -1
                                            log(f"[latency] transcript->first audio ~{lat} ms")
                                            await send_json({"type": "latency", "ms": lat})
                                            got_audio = True
                                        await ws.send_bytes(p.inline_data.data)
                            if getattr(sc, "turn_complete", None):
                                turns += 1
                                log(f"[turn] {turns} complete")
                                guard["tripped"] = False
                                got_audio = False
                                t_last_user = None
                                await send_json({"type": "turn_complete", "n": turns})
                        log("[recv] generator returned (normal after a turn); re-entering")
                except Exception as e:  # noqa: BLE001
                    log(f"[live_to_browser] ended: {type(e).__name__} {repr(str(e))[:300]}")
                    try:
                        await send_json({"type": "sys", "text": f"Gemini stream ended: {type(e).__name__} {str(e)[:120]}"})
                    except Exception:
                        pass
                finally:
                    log(f"[session] live_to_browser exiting after {turns} turns")
                    stop.set()

            await asyncio.gather(browser_to_live(), live_to_browser())
    except Exception as e:  # noqa: BLE001
        log(f"[conn] error: {type(e).__name__} {str(e)[:300]}")
        try:
            await send_json({"type": "error", "text": str(e)[:300]})
        except Exception:
            pass
    finally:
        log("[conn] closing browser socket")
        try:
            await ws.close()
        except Exception:
            pass
