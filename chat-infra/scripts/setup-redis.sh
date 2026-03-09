#!/usr/bin/env bash
set -euo pipefail

# ============================================
# GCP Memorystore for Redis + VPC Connector
# ============================================
# Provisions a Memorystore for Redis instance and a Serverless VPC
# Access connector so Cloud Run can reach it.
#
# Usage: ./setup-redis.sh
#
# Prerequisites:
#   - gcloud CLI authenticated with sufficient IAM permissions
#   - APIs enabled: redis.googleapis.com, vpcaccess.googleapis.com

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh" 2>/dev/null || true

# ── Configuration ──
PROJECT_ID="${GCP_PROJECT_ID:-mental-help-global-25}"
REGION="${GCP_REGION:-europe-west1}"
REDIS_INSTANCE_NAME="${REDIS_INSTANCE_NAME:-chat-redis}"
REDIS_TIER="${REDIS_TIER:-BASIC}"
REDIS_SIZE_GB="${REDIS_SIZE_GB:-1}"
REDIS_VERSION="${REDIS_VERSION:-REDIS_7_0}"
VPC_CONNECTOR_NAME="${VPC_CONNECTOR_NAME:-chat-vpc-connector}"
VPC_CONNECTOR_RANGE="${VPC_CONNECTOR_RANGE:-10.8.0.0/28}"
NETWORK="${VPC_NETWORK:-default}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Memorystore for Redis + VPC Connector            ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Project:    ${PROJECT_ID}"
echo "║  Region:     ${REGION}"
echo "║  Instance:   ${REDIS_INSTANCE_NAME}"
echo "║  Tier:       ${REDIS_TIER} (${REDIS_SIZE_GB} GB)"
echo "║  Connector:  ${VPC_CONNECTOR_NAME}"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ── Enable required APIs ──
echo "→ Enabling required APIs..."
gcloud services enable redis.googleapis.com \
  vpcaccess.googleapis.com \
  --project="${PROJECT_ID}" --quiet

# ── Create Serverless VPC Access connector ──
echo "→ Creating VPC connector: ${VPC_CONNECTOR_NAME}..."
if gcloud compute networks vpc-access connectors describe "${VPC_CONNECTOR_NAME}" \
    --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "  VPC connector already exists — skipping."
else
  gcloud compute networks vpc-access connectors create "${VPC_CONNECTOR_NAME}" \
    --region="${REGION}" \
    --network="${NETWORK}" \
    --range="${VPC_CONNECTOR_RANGE}" \
    --project="${PROJECT_ID}"
  echo "  ✓ VPC connector created."
fi

# ── Create Memorystore for Redis instance ──
echo "→ Creating Memorystore instance: ${REDIS_INSTANCE_NAME}..."
if gcloud redis instances describe "${REDIS_INSTANCE_NAME}" \
    --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "  Memorystore instance already exists — skipping."
else
  gcloud redis instances create "${REDIS_INSTANCE_NAME}" \
    --region="${REGION}" \
    --tier="${REDIS_TIER}" \
    --size="${REDIS_SIZE_GB}" \
    --redis-version="${REDIS_VERSION}" \
    --network="${NETWORK}" \
    --project="${PROJECT_ID}"
  echo "  ✓ Memorystore instance created."
fi

# ── Retrieve Redis host/port ──
REDIS_HOST=$(gcloud redis instances describe "${REDIS_INSTANCE_NAME}" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --format='value(host)')
REDIS_PORT=$(gcloud redis instances describe "${REDIS_INSTANCE_NAME}" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --format='value(port)')

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Redis host: ${REDIS_HOST}"
echo "║  Redis port: ${REDIS_PORT}"
echo "╚════════════════════════════════════════════════════════════╝"

# ── Store Redis host in Secret Manager ──
echo "→ Storing Redis connection details in Secret Manager..."
for SECRET_NAME in "redis-host" "redis-port"; do
  if ! gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud secrets create "${SECRET_NAME}" --project="${PROJECT_ID}" --replication-policy="automatic"
  fi
done

echo -n "${REDIS_HOST}" | gcloud secrets versions add "redis-host" \
  --data-file=- --project="${PROJECT_ID}"
echo -n "${REDIS_PORT}" | gcloud secrets versions add "redis-port" \
  --data-file=- --project="${PROJECT_ID}"
echo "  ✓ Secrets stored."

# ── Update Cloud Run services with VPC connector ──
echo "→ Configuring Cloud Run services with VPC connector..."
for SERVICE in "chat-backend-dev" "chat-backend"; do
  if gcloud run services describe "${SERVICE}" \
      --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud run services update "${SERVICE}" \
      --region="${REGION}" \
      --project="${PROJECT_ID}" \
      --vpc-connector="${VPC_CONNECTOR_NAME}" \
      --update-env-vars="REDIS_HOST=${REDIS_HOST},REDIS_PORT=${REDIS_PORT}" \
      --quiet
    echo "  ✓ ${SERVICE} updated with VPC connector and Redis env vars."
  else
    echo "  ⚠ ${SERVICE} not found — skip (will be configured on next deploy)."
  fi
done

echo ""
echo "✓ Redis infrastructure setup complete."
echo ""
echo "Next steps:"
echo "  1. Deploy chat-backend with Redis token store"
echo "  2. Verify /api/health reports Redis status"
echo "  3. After 7 days, remove PostgreSQL refresh_tokens table"
