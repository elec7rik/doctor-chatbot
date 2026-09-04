"""Google Cloud Speech-to-Text via REST, reusing our Vertex auth.

Transcribes a short hold-to-talk clip (16 kHz, 16-bit mono PCM). Doing this
server-side means voice input works in every browser — the built-in Web Speech
recogniser is missing or unreachable in Brave, Firefox, Safari-without-Dictation
and some networks. No extra dependency: stdlib urllib + our token helper.
"""
import base64
import json
import urllib.error
import urllib.request

from .config import settings
from .gcp_auth import access_token

_URL = "https://speech.googleapis.com/v1/speech:recognize"
SAMPLE_RATE = 16000
MAX_BYTES = SAMPLE_RATE * 2 * 30  # 30 s of audio; synchronous recognize allows up to 60 s


def transcribe(pcm: bytes) -> str:
    if not pcm:
        return ""
    body = json.dumps(
        {
            "config": {
                "encoding": "LINEAR16",
                "sampleRateHertz": SAMPLE_RATE,
                "languageCode": settings.STT_LANGUAGE_CODE,
                "model": settings.STT_MODEL,
                "enableAutomaticPunctuation": True,
            },
            "audio": {"content": base64.b64encode(pcm).decode()},
        }
    ).encode()
    headers = {
        "Authorization": f"Bearer {access_token()}",
        "Content-Type": "application/json",
    }
    if settings.GEMINI_AUTH == "gcloud":  # see tts.py: only user credentials need this
        headers["x-goog-user-project"] = settings.GCP_PROJECT_ID
    req = urllib.request.Request(_URL, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            payload = json.load(r)
    except urllib.error.HTTPError as e:  # surface Google's reason, not just the status
        raise RuntimeError(f"speech {e.code}: {e.read().decode(errors='replace')[:300]}") from None
    return " ".join(
        alt["transcript"].strip()
        for res in payload.get("results", [])
        for alt in res.get("alternatives", [])[:1]
        if alt.get("transcript")
    ).strip()
