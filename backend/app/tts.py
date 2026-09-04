"""Google Cloud Text-to-Speech via REST, reusing our Vertex auth.

Turns the professor's reply text into speech using a premium Google voice
(Studio / Chirp3-HD). No extra dependency — stdlib urllib + our token helper.
"""
import base64
import json
import urllib.request

from .config import settings
from .gcp_auth import access_token

_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
_MAX_CHARS = 2500  # snappy answers are short; a safety belt against huge inputs

_MEDIA = {
    "MP3": "audio/mpeg",
    "OGG_OPUS": "audio/ogg",
    "LINEAR16": "audio/wav",
    "MULAW": "audio/basic",
    "ALAW": "audio/basic",
}


def media_type() -> str:
    return _MEDIA.get(settings.TTS_AUDIO_ENCODING, "audio/mpeg")


def synthesize(text: str) -> bytes:
    text = (text or "").strip()[:_MAX_CHARS]
    if not text:
        return b""
    body = json.dumps(
        {
            "input": {"text": text},
            "voice": {
                "languageCode": settings.TTS_LANGUAGE_CODE,
                "name": settings.TTS_VOICE,
            },
            "audioConfig": {
                "audioEncoding": settings.TTS_AUDIO_ENCODING,
                "speakingRate": settings.TTS_SPEAKING_RATE,
            },
        }
    ).encode()
    headers = {
        "Authorization": f"Bearer {access_token()}",
        "Content-Type": "application/json",
    }
    # Quota-project attribution is only needed for user credentials (local dev,
    # GEMINI_AUTH=gcloud). With a service account (prod/adc) the call bills to the
    # SA's own project, and sending this header would require serviceusage.use.
    if settings.GEMINI_AUTH == "gcloud":
        headers["x-goog-user-project"] = settings.GCP_PROJECT_ID
    req = urllib.request.Request(_URL, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        payload = json.load(r)
    return base64.b64decode(payload["audioContent"])
