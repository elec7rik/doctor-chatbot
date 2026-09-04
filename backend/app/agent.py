"""The Nutty Professor brain: system prompt + catalogue + guardrails, calling
Vertex AI via the google-genai SDK.

Auth (settings.GEMINI_AUTH):
  - "adc":    Application Default Credentials — service account on Cloud Run, or
              `gcloud auth application-default login` locally. The production path.
  - "gcloud": the ACTIVE gcloud account's access token via the CLI — local-dev
              convenience (no ADC, no fresh 2FA). Not for production."""
from datetime import timedelta

import google.auth.credentials as ga_credentials
from google.auth import _helpers as ga_helpers
from google import genai
from google.genai import types

from .catalogue import build_catalogue_block
from .config import settings
from .gcp_auth import access_token
from .guardrails import check_emergency
from .prompt import SYSTEM_PROMPT
from .sanitize import sanitize_text

# Behaviour (prompt) + knowledge (catalogue), assembled once.
SYSTEM = SYSTEM_PROMPT + "\n\n" + build_catalogue_block()


class _GcloudCLICredentials(ga_credentials.Credentials):
    """Active gcloud account's token for local dev. Refreshes via the shared,
    cached helper; a short TTL makes the SDK re-check often (the underlying
    gcloud call is cached, so this stays cheap) and never serves a stale token."""

    def refresh(self, request):
        self.token = access_token()
        # Use google-auth's own clock so `.expired` comparisons are exact.
        self.expiry = ga_helpers.utcnow() + timedelta(minutes=20)


def _credentials():
    if settings.GEMINI_AUTH == "gcloud":
        creds = _GcloudCLICredentials()
        creds.refresh(None)  # fetch an initial token now
        return creds
    return None  # let google-genai use ADC


_client = None


def client():
    global _client
    if _client is None:
        kwargs = dict(vertexai=True, project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
        creds = _credentials()
        if creds is not None:
            kwargs["credentials"] = creds
        _client = genai.Client(**kwargs)
    return _client


def _to_contents(history, user_message):
    contents = []
    for turn in history:
        role = "model" if turn.get("role") == "model" else "user"
        contents.append({"role": role, "parts": [{"text": turn["text"]}]})
    contents.append({"role": "user", "parts": [{"text": user_message}]})
    return contents


def process_message(history, user_message):
    """history: list of {"role": "user"|"model", "text": str}. Returns {reply, guardrail}."""
    guard = check_emergency(user_message)
    if guard:
        return {"reply": guard, "guardrail": "emergency"}

    resp = client().models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=_to_contents(history, user_message),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM,
            temperature=settings.TEMPERATURE,
            max_output_tokens=settings.MAX_OUTPUT_TOKENS,
        ),
    )
    text = (resp.text or "").strip()
    if not text:
        text = (
            "Sorry — I couldn't produce an answer just then. Please try rephrasing. "
            "Remember I offer general information only, not medical advice."
        )
    return {"reply": sanitize_text(text), "guardrail": None}


def stream_message(history, user_message):
    """Generator yielding reply text chunks as the model produces them.
    The deterministic guardrail short-circuits to a single safe chunk."""
    guard = check_emergency(user_message)
    if guard:
        yield guard
        return

    stream = client().models.generate_content_stream(
        model=settings.GEMINI_MODEL,
        contents=_to_contents(history, user_message),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM,
            temperature=settings.TEMPERATURE,
            max_output_tokens=settings.MAX_OUTPUT_TOKENS,
        ),
    )
    produced = False
    for chunk in stream:
        try:
            piece = chunk.text
        except Exception:  # noqa: BLE001 — a non-text chunk (e.g. safety) has no .text
            piece = None
        if piece:
            produced = True
            yield piece
    if not produced:
        yield (
            "Sorry — I couldn't produce an answer just then. Please try rephrasing. "
            "Remember I offer general information only, not medical advice."
        )
