#!/usr/bin/env bash
set -euo pipefail

# ---- CONFIG (edit these) ----
OWNER="MentalHelpGlobal"
REPO="chat-client"

# Auto-detect GCP Project ID from gcloud config
PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: No GCP project configured. Run: gcloud config set project PROJECT_ID" >&2
  exit 1
fi
echo "Using GCP Project: $PROJECT_ID"

REGION="europe-west1"                 # must match your workflow region
SERVICE_DEV="chat-backend-dev"
SERVICE_PROD="chat-backend"

VERTEX_LOCATION="us-central1"
VERTEX_MODEL="publishers/google/models/gemini-2.5-flash-lite"
# -----------------------------

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }; }

require_cmd gh
require_cmd gcloud

echo "== Checking GitHub auth =="
gh auth status

echo "== Checking gcloud auth & selecting project =="
gcloud auth list
gcloud config set project "$PROJECT_ID" >/dev/null

echo "== Enabling Vertex AI API (idempotent) =="
gcloud services enable aiplatform.googleapis.com

echo "== Setting GitHub Environment variables (dev/prod) =="
for ENV in dev prod; do
  echo "-- Environment: $ENV"
  gh api -X PUT "repos/$OWNER/$REPO/environments/$ENV/variables/LLM_PROVIDER" \
    -f name=LLM_PROVIDER -f value="vertex" >/dev/null
  gh api -X PUT "repos/$OWNER/$REPO/environments/$ENV/variables/VERTEX_LOCATION" \
    -f name=VERTEX_LOCATION -f value="$VERTEX_LOCATION" >/dev/null
  gh api -X PUT "repos/$OWNER/$REPO/environments/$ENV/variables/VERTEX_MODEL" \
    -f name=VERTEX_MODEL -f value="$VERTEX_MODEL" >/dev/null

  # Workflow injects VERTEX_PROJECT_ID into Cloud Run; set it from your single source of truth
  gh api -X PUT "repos/$OWNER/$REPO/environments/$ENV/variables/VERTEX_PROJECT_ID" \
    -f name=VERTEX_PROJECT_ID -f value="$PROJECT_ID" >/dev/null
done
echo "GitHub environment vars set."

echo "== Granting Vertex permissions to Cloud Run runtime service accounts =="
for SERVICE in "$SERVICE_DEV" "$SERVICE_PROD"; do
  echo "-- Service: $SERVICE"
  RUNTIME_SA="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
  if [[ -z "${RUNTIME_SA:-}" ]]; then
    echo "  ! Service not found (skipping): $SERVICE"
    continue
  fi
  echo "  Runtime SA: $RUNTIME_SA"

  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="roles/aiplatform.user" \
    --quiet >/dev/null

  # Optional: make project id available via standard env var at runtime (harmless if already set)
  gcloud run services update "$SERVICE" --region "$REGION" \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
    --quiet >/dev/null

  echo "  OK"
done

echo "== Triggering dev deployment workflow =="
gh workflow run "Deploy to GCP" --repo "$OWNER/$REPO" --ref develop -f environment=dev >/dev/null

echo "== Waiting for workflow run to appear =="
RUN_ID=""
for _ in {1..30}; do
  RUN_ID="$(gh run list --repo "$OWNER/$REPO" --workflow "Deploy to GCP" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
  [[ -n "${RUN_ID:-}" ]] && break
  sleep 2
done

if [[ -z "${RUN_ID:-}" ]]; then
  echo "Could not find the triggered run. Check Actions UI." >&2
  exit 1
fi

echo "Run ID: $RUN_ID"
echo "== Watching run (Ctrl+C to stop watching) =="
gh run watch "$RUN_ID" --repo "$OWNER/$REPO" --interval 10

echo "== Final run summary =="
gh run view "$RUN_ID" --repo "$OWNER/$REPO" --json status,conclusion,url,createdAt,event,headBranch --jq '.'

echo "Done."

