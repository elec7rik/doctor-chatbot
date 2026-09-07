# Deploying The Nutty Professor (My Longevity Hub)

All-GCP: **two Cloud Run services** (backend API + Next.js web) in the single
project **`doctor-chatbot-507406`**, built and shipped by GitHub Actions.

| | Backend (`backend/Dockerfile` → repo-root `Dockerfile`) | Frontend (`frontend/Dockerfile`) |
|---|---|---|
| Service (staging / prod) | `nutty-professor-api-staging` / `-prod` | `nutty-professor-web-staging` / `-prod` |
| Port | 8080 | 3000 |
| Talks to | Vertex (chat west4 / voice central2), TTS, STT | the backend (server-side proxy + browser `/live` WS) |

**Auth in prod is keyless**: no `.env` reaches the image (git/docker/gcloud-ignored),
so `GEMINI_AUTH` defaults to `adc` and the container uses the runtime **service
account** via the metadata server. Nothing to configure per-deploy.

**Region note:** Cloud Run runs in `europe-west4`; that's independent of the
Vertex regions the backend calls (chat `europe-west4`, voice `europe-central2`).

---

## Pipelines

- **`.github/workflows/ci.yml`** — push to `main` → **staging**. Rebuilds only the
  service whose files changed (`dorny/paths-filter`).
- **`.github/workflows/prod.yml`** — push a `release/YY.MM.DD` branch (cut from
  `main`) → **production**. Deploys both services as a consistent pair.

The frontend derives the backend's Cloud Run URL at deploy time (`gcloud run
services describe`) and uses it for both the baked `NEXT_PUBLIC_LIVE_WS_URL`
(the browser-direct voice WebSocket) and the runtime `BACKEND_URL` (server-side
proxy) — so no URL is ever hardcoded.

---

## One-time bootstrap

Run once, as the project owner (the **colllective** account). Substitute your
active account if different.

```bash
gcloud config set project doctor-chatbot-507406 --account colllective57health@gmail.com
```

**1. Enable APIs**

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com iamcredentials.googleapis.com aiplatform.googleapis.com texttospeech.googleapis.com speech.googleapis.com
```

**2. Artifact Registry repo** (matches `AR_REGISTRY` in the workflows)

```bash
gcloud artifacts repositories create doctor-chatbot --repository-format=docker --location=europe-west4 --description="Nutty Professor images"
```

**3. Runtime service account** (what the Cloud Run services run as; needs Vertex)

```bash
gcloud iam service-accounts create nutty-prof-run --display-name="Nutty Professor runtime"
gcloud projects add-iam-policy-binding doctor-chatbot-507406 --member="serviceAccount:nutty-prof-run@doctor-chatbot-507406.iam.gserviceaccount.com" --role=roles/aiplatform.user
```

(TTS/STT need only their APIs enabled — the SA's cloud-platform token covers them.)

**4. Deployer service account** (what GitHub Actions impersonates)

```bash
gcloud iam service-accounts create gh-deployer --display-name="GitHub Actions deployer"
for R in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding doctor-chatbot-507406 --member="serviceAccount:gh-deployer@doctor-chatbot-507406.iam.gserviceaccount.com" --role=$R
done
```

**5. Workload Identity Federation** (keyless GitHub → GCP, restricted to this repo)

```bash
gcloud iam workload-identity-pools create github-pool --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github-pool --display-name="GitHub OIDC" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='elec7rik/doctor-chatbot'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

PROJECT_NUMBER=$(gcloud projects describe doctor-chatbot-507406 --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding gh-deployer@doctor-chatbot-507406.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/elec7rik/doctor-chatbot"
```

**6. GitHub repo secrets** (Settings → Secrets and variables → Actions), or via CLI:

```bash
PROJECT_NUMBER=$(gcloud projects describe doctor-chatbot-507406 --format='value(projectNumber)')
gh secret set GCP_WIF_PROVIDER --repo elec7rik/doctor-chatbot --body "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
gh secret set GCP_SA_EMAIL --repo elec7rik/doctor-chatbot --body "gh-deployer@doctor-chatbot-507406.iam.gserviceaccount.com"
```

**7. Create the backend service once** so the frontend can resolve its URL on the
first CI run (from the repo root — `--source .` builds via Cloud Build):

```bash
gcloud run deploy nutty-professor-api-staging --source . --region=europe-west4 --allow-unauthenticated --service-account=nutty-prof-run@doctor-chatbot-507406.iam.gserviceaccount.com --port=8080 --timeout=3600 --memory=512Mi
```

---

## Going live

**Staging** — every push to `main` deploys automatically:

```bash
git push origin main
```

Then open the web service URL:

```bash
gcloud run services describe nutty-professor-web-staging --region=europe-west4 --format='value(status.url)'
```

**Production** — cut a dated release branch from `main` and push it (this triggers
`prod.yml`; production deploys deserve a deliberate, explicit push):

```bash
git checkout -b release/$(date +%y.%m.%d) main && git push -u origin release/$(date +%y.%m.%d)
```

At launch, raise `--min-instances` to `1` on both prod services to remove cold
starts.

---

## Post-launch hardening (not blocking)

- Lock the `/live` WebSocket to the web service's origin (currently open).
- Move the in-memory per-IP rate limiter to Redis / Cloud Armor (it's per-instance).
- Put both services behind an external HTTPS Load Balancer + Cloud Armor and a
  custom domain; switch Cloud Run ingress to `internal-and-cloud-load-balancing`.
