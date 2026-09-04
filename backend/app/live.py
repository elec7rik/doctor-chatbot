"""'Talk to the Prof' — live native-audio voice call over a WebSocket.

Relays browser audio <-> Vertex Gemini Live (native audio, Charon voice), driven
by hold-to-talk: voice-activity detection is DISABLED and the browser sends
activity_start / activity_end as the user holds/releases, so audio only uploads
while they speak (proven robust on weak mobile links, unlike hands-free VAD).

On a voice call the professor never reads a web address aloud. Instead, when he
wants to point the caller to a brand or product, the model calls the
``show_link_card`` tool; we resolve it to a REAL catalogue URL here and push a
tappable card to the browser. This is deterministic — the link on the card can
only ever be a verified product page or a known brand homepage.

The real deterministic emergency guardrail runs on the live input transcription;
when it trips we stop relaying the model's audio for that turn and hand the
browser a safety message to speak.
"""
import asyncio
import re
import json

from google.genai import types

from . import agent
from .catalogue import load_catalogue
from .config import settings
from .guardrails import check_emergency
from .sanitize import sanitize_text
from . import guides

_VOICE_ADDENDUM = (
    "\n\n## THIS IS A LIVE VOICE CALL — how to speak\n"
    "You are speaking out loud on a phone-style call, not writing. So:\n"
    "- Talk like a warm, plain-speaking person. Short, natural spoken sentences — usually two or three, "
    "a few more only if the question genuinely needs it. No lists, no bullet points, no markdown, no headings.\n"
    "- Still give the REAL substance. You have exactly the same knowledge, brand guidance and partner-product "
    "list as the written version above — use it. Give the honest answer, say plainly what the evidence shows "
    "(strong, promising, or animal-only), and the practical takeaway. Never flatten it into a vague one-liner.\n"
    "- NEVER say a web address, URL or domain out loud — they are unreadable in speech and the caller cannot "
    "tap something you say. Never spell one out letter by letter either.\n"
    "- Instead, whenever you would point someone to a brand or a specific product, CALL THE show_link_card "
    "TOOL. It puts a tappable card with the real link on the caller's screen. Call it with the brand "
    "(My Peptides, MyPeptides Labs, theNAD or Imnatura) and, for a specific My Peptides product, the product "
    "name (for example 'BPC-157'). Then simply tell them out loud that you've popped it up on their screen — "
    "for example \"I've put My Peptides up on your screen for you.\" One card per answer, the same one-pointer "
    "rule as above, and only when a brand genuinely fits and the compliance rules allow it.\n"
    "- We also publish our own free educational guides on this site (listed above). When one genuinely fits "
    "the question, CALL THE show_guide_card TOOL with the guide's slug (for example 'better-sleep') to put a "
    "tappable guide card on the caller's screen, then mention it out loud — for example \"I've popped our "
    "sleep guide on your screen.\" Prefer a guide for general, educational questions; keep it to one card.\n"
    "- Never invent a link, and never say \"mylongevityhub.com\" or turn the platform's name into a web address "
    "— My Longevity Hub is simply the site they are already on.\n"
    "- Do NOT speak any written disclaimer footer, and never say the words \"The Nutty Professor is an AI "
    "character\" out loud — the disclaimer is shown on screen the whole call. Just answer the question.\n"
    "- Every safety and compliance rule above still applies: general information only, never a dose, never tell "
    "anyone to take a research peptide, and if someone describes a medical emergency tell them to call 999 or NHS 111 now."
)

# Strip the "append this exact footer" DISCLAIMER instruction: on a voice call the
# model would read it aloud every health-significant turn. The page shows the
# disclaimer permanently, and the emergency guardrail is separate.
_DISCLAIMER_RE = re.compile(r"##\s*DISCLAIMER.*?qualified clinician\.", re.DOTALL | re.IGNORECASE)


def system_instruction() -> str:
    base = _DISCLAIMER_RE.sub("", agent.SYSTEM).rstrip()
    return base + _VOICE_ADDENDUM


# ---------------------------------------------------------------------------
# Link cards: map a model tool call -> a real, verified URL (never fabricated).
# ---------------------------------------------------------------------------
_BRANDS = {
    "my-peptides":    {"name": "My Peptides",     "home": "https://my-peptides.co.uk"},
    "mypeptideslabs": {"name": "MyPeptides Labs",  "home": "https://mypeptideslabs.com"},
    "thenad":         {"name": "theNAD",           "home": "https://thenad.co.uk"},
    "imnatura":       {"name": "Imnatura",         "home": "https://imnatura.co.uk"},
}


def _alnum(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _brand_key(s: str) -> str | None:
    a = _alnum(s)
    if not a:
        return None
    if "mypeptideslab" in a or "peptideslab" in a:
        return "mypeptideslabs"
    if "mypeptide" in a or a == "peptides":
        return "my-peptides"
    if "nad" in a:
        return "thenad"
    if "imnatura" in a or "natura" in a:
        return "imnatura"
    return None


def _product_index() -> dict:
    """alnum(name/slug) -> {name, url} for every bridge-eligible My Peptides product.
    Only bridge-eligible items get a card; sensitive/omitted ones never surface."""
    idx: dict = {}
    for b in load_catalogue():
        for p in b.get("products", []):
            if not p.get("bridgeEligible", False):
                continue
            url, name = p.get("url", ""), p.get("name", "")
            if not url or not name:
                continue
            slug = url.rstrip("/").rsplit("/", 1)[-1]
            entry = {"name": name, "url": url}
            idx[_alnum(name)] = entry
            idx[_alnum(slug)] = entry
    return idx


_PIDX = _product_index()


def _match_product(q: str):
    a = _alnum(q)
    if not a:
        return None
    if a in _PIDX:
        return _PIDX[a]
    for k, v in _PIDX.items():          # loose contains match, e.g. "bpc 157" / "cjc1295"
        if len(a) >= 4 and (a in k or k in a):
            return v
    return None


def _resolve_card(args: dict) -> dict:
    """Turn the model's {brand, product?} into a card with a guaranteed-real URL."""
    brand = _brand_key(str(args.get("brand", ""))) or "my-peptides"
    b = _BRANDS[brand]
    product = str(args.get("product") or "").strip()
    if brand == "my-peptides" and product:
        m = _match_product(product)
        if m:
            return {"url": m["url"], "title": m["name"], "subtitle": b["name"], "brand": brand}
    return {"url": b["home"], "title": b["name"], "subtitle": "Visit the site", "brand": brand}


_LINK_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="show_link_card",
            description=(
                "Show a tappable link card on the caller's screen so they can visit a partner brand or a "
                "specific My Peptides product WITHOUT you reading any web address aloud. Call this whenever "
                "you want to point the caller to a brand or product, then just tell them out loud that "
                "you've put it up on their screen."
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "brand": types.Schema(
                        type=types.Type.STRING,
                        description="Which partner brand: My Peptides, MyPeptides Labs, theNAD, or Imnatura.",
                    ),
                    "product": types.Schema(
                        type=types.Type.STRING,
                        description="Optional; My Peptides only. The specific product, e.g. 'BPC-157'. "
                        "Leave empty for a general brand link.",
                    ),
                },
                required=["brand"],
            ),
        )
    ]
)


_GUIDE_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="show_guide_card",
            description=(
                "Show a tappable card linking one of My Longevity Hub's own educational guides on the caller's "
                "screen. Call this when a guide listed in your instructions fits the question, then tell the "
                "caller out loud that you've put it on their screen."
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "guide": types.Schema(
                        type=types.Type.STRING,
                        description="The guide slug, e.g. 'better-sleep', 'testosterone', 'menopause'.",
                    ),
                },
                required=["guide"],
            ),
        )
    ]
)


def live_config() -> types.LiveConnectConfig:
    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=settings.LIVE_VOICE)
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        # Hold-to-talk: the browser marks turn start/end, so no server-side VAD.
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(disabled=True)
        ),
        tools=[_LINK_TOOL, _GUIDE_TOOL],
        system_instruction=system_instruction(),
    )


async def _send(ws, obj) -> None:
    await ws.send_text(json.dumps(obj))


async def relay(ws) -> None:
    """Full-duplex bridge between the browser WebSocket and one Gemini Live session."""
    stop = asyncio.Event()
    guard = {"tripped": False}  # once an emergency is heard this turn, drop the model's audio
    try:
        async with agent.client().aio.live.connect(
            model=settings.GEMINI_LIVE_MODEL, config=live_config()
        ) as session:
            await _send(ws, {"type": "ready"})

            async def pump_up():
                try:
                    while True:
                        msg = await ws.receive()
                        if msg.get("type") == "websocket.disconnect":
                            break
                        data = msg.get("bytes")
                        if data:
                            await session.send_realtime_input(
                                audio=types.Blob(data=data, mime_type="audio/pcm;rate=16000")
                            )
                            continue
                        text = msg.get("text")
                        if not text:
                            continue
                        m = json.loads(text)
                        if m.get("type") == "start":
                            await session.send_realtime_input(activity_start=types.ActivityStart())
                        elif m.get("type") == "end":
                            await session.send_realtime_input(activity_end=types.ActivityEnd())
                finally:
                    stop.set()

            async def pump_down():
                try:
                    while not stop.is_set():
                        async for resp in session.receive():
                            if stop.is_set():
                                break
                            # --- tool call: resolve to a real URL and push a card ---
                            tc = getattr(resp, "tool_call", None)
                            if tc and getattr(tc, "function_calls", None):
                                fresp = []
                                for fc in tc.function_calls:
                                    if fc.name == "show_guide_card":
                                        card = guides.resolve_guide(str((fc.args or {}).get("guide", "")))
                                    else:
                                        card = _resolve_card(dict(fc.args or {}))
                                    if card and not guard["tripped"]:
                                        await _send(ws, {"type": "card", **card})
                                    fresp.append(
                                        types.FunctionResponse(
                                            id=fc.id, name=fc.name, response={"result": "shown"}
                                        )
                                    )
                                try:
                                    await session.send_tool_response(function_responses=fresp)
                                except Exception:
                                    pass
                            sc = resp.server_content
                            if not sc:
                                continue
                            it = getattr(sc, "input_transcription", None)
                            if it and it.text:
                                await _send(ws, {"type": "user", "text": it.text})
                                safe = check_emergency(it.text)
                                if safe:
                                    guard["tripped"] = True
                                    await _send(ws, {"type": "guardrail", "text": safe})
                            ot = getattr(sc, "output_transcription", None)
                            if ot and ot.text and not guard["tripped"]:
                                await _send(ws, {"type": "bot", "text": sanitize_text(ot.text)})
                            if getattr(sc, "interrupted", None):
                                await _send(ws, {"type": "interrupted"})
                            mt = getattr(sc, "model_turn", None)
                            if mt and not guard["tripped"]:
                                for p in mt.parts:
                                    if getattr(p, "inline_data", None) and p.inline_data.data:
                                        await ws.send_bytes(p.inline_data.data)
                            if getattr(sc, "turn_complete", None):
                                guard["tripped"] = False
                                await _send(ws, {"type": "turn"})
                finally:
                    stop.set()

            up = asyncio.create_task(pump_up())
            down = asyncio.create_task(pump_down())
            done, pending = await asyncio.wait(
                {up, down}, timeout=settings.LIVE_MAX_CALL_SEC, return_when=asyncio.FIRST_COMPLETED
            )
            if not done:  # hit the call-length cap with both sides still live
                try:
                    await _send(ws, {"type": "info", "text": "call-time-limit"})
                except Exception:
                    pass
            for t in pending:
                t.cancel()
            await asyncio.gather(up, down, return_exceptions=True)
    except Exception as e:  # noqa: BLE001 — report and close cleanly
        try:
            await _send(ws, {"type": "error", "text": str(e)[:200]})
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass
