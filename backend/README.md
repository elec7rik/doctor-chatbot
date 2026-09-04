# Nutty Professor — chat backend (Phase 2)

FastAPI service that wraps the validated Nutty Professor brain and serves it over HTTP.
Same Vertex AI pattern as my-peptides (google-genai SDK, ADC auth), our own implementation.

## Layout
- `app/config.py` — settings (GCP project/region/model, prompt + catalogue paths)
- `app/prompt.py` — loads `../prompts/system-instructions.md` (the behaviour)
- `app/catalogue.py` — loads `../catalogue/*.json` (the knowledge), builds the context block
- `app/guardrails.py` — deterministic pre-LLM crisis/emergency backstop
- `app/agent.py` — assembles system prompt + catalogue, calls Vertex, applies guardrails
- `app/sessions.py` — in-memory session history (Redis/Postgres later)
- `app/main.py` — FastAPI app: `POST /chat`, `GET /health`

## Setup
```
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Auth (local): the google-genai Vertex client uses Application Default Credentials.
Make sure ADC is your project account:
```
gcloud auth application-default login
gcloud auth application-default set-quota-project doctor-chatbot-507406
```
In production: run under a service account with the **Vertex AI User** role (no key files).

## Run
```
.venv/bin/uvicorn app.main:app --reload --port 8000
```
Then:
```
curl -s localhost:8000/chat -H 'content-type: application/json' \
  -d '{"message":"does NMN reverse ageing?"}'
```

## Quick check (no server)
```
PYTHONPATH=. .venv/bin/python smoke_test.py
```

## Config
Defaults live in `app/config.py`; override via env or the repo-root `.env`
(`GCP_PROJECT_ID`, `GCP_REGION`, `GEMINI_MODEL`, `MAX_OUTPUT_TOKENS`, …).
