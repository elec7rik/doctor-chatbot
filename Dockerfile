# ---- The Nutty Professor / My Longevity Hub — Cloud Run image ----
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# 1) Dependencies first, for better layer caching.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

# 2) App code + the "brain" it reads at runtime. config.py resolves
#    REPO = <app dir>/../..  so prompts/ and catalogue/ must sit alongside
#    backend/ exactly as they do in the repo.
COPY backend/ backend/
COPY prompts/ prompts/
COPY catalogue/ catalogue/

# Cloud Run routes traffic to $PORT (8080 by default). Bind uvicorn to it;
# `exec` makes uvicorn PID 1 so it receives SIGTERM on scale-down.
ENV PORT=8080
CMD exec uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port ${PORT}
