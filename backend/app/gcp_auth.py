"""Shared GCP access-token helper (Vertex / Text-to-Speech / Speech-to-Text).

Mirrors agent.py's two auth modes and caches the token so we don't shell out to
gcloud (or refresh ADC) on every request.
  - "gcloud": the ACTIVE gcloud account's token via the CLI — local-dev convenience.
  - "adc":    Application Default Credentials — service account on Cloud Run, or
              `gcloud auth application-default login` locally. The production path.
"""
import subprocess
import time

from .config import settings

_CLOUD_PLATFORM = "https://www.googleapis.com/auth/cloud-platform"
_cache = {"token": None, "exp": 0.0}


def access_token() -> str:
    now = time.time()
    if _cache["token"] and now < _cache["exp"]:
        return _cache["token"]

    if settings.GEMINI_AUTH == "gcloud":
        cmd = ["gcloud", "auth", "print-access-token"]
        if settings.GCLOUD_ACCOUNT:
            cmd.append(f"--account={settings.GCLOUD_ACCOUNT}")
        token = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    else:
        import google.auth
        from google.auth.transport.requests import Request

        creds, _ = google.auth.default(scopes=[_CLOUD_PLATFORM])
        creds.refresh(Request())
        token = creds.token

    _cache.update(token=token, exp=now + 50 * 60)  # tokens last ~60 min; refresh at 50
    return token
