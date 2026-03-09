#!/bin/bash
#
# Secret Manager Consolidation Script
#
# Ensures all application secrets exist in Google Secret Manager
# with proper IAM access for the Cloud Run compute service account.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Secret Manager API enabled on the project
#   - Sufficient IAM permissions (Secret Manager Admin)
#
# Usage:
#   ./setup-secrets.sh              # Create missing secrets, report all
#   ./setup-secrets.sh --audit-only # Report only, no changes
#
# Secret values are NEVER echoed or logged.
# All operations are idempotent — safe to re-run.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

# ──────────────────────────────────────────────
# Parse arguments
# ──────────────────────────────────────────────

AUDIT_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --audit-only)
      AUDIT_ONLY=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--audit-only]"
      echo ""
      echo "Options:"
      echo "  --audit-only  Report secret status without creating or modifying"
      echo "  --help        Show this help message"
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ──────────────────────────────────────────────
# Prerequisites
# ──────────────────────────────────────────────

header "Secret Manager Consolidation"

info "Checking prerequisites..."
check_gcloud || exit 1
check_jq || exit 1
check_gcloud_auth || exit 1

# Verify Secret Manager API is enabled
if ! check_api_enabled "secretmanager.googleapis.com" "$DEFAULT_GCP_PROJECT"; then
  error "Secret Manager API is not enabled. Run:"
  error "  gcloud services enable secretmanager.googleapis.com --project=${DEFAULT_GCP_PROJECT}"
  exit 1
fi
success "Secret Manager API is enabled"

echo ""

# ──────────────────────────────────────────────
# Load configuration
# ──────────────────────────────────────────────

SECRETS_CONFIG="${CONFIG_DIR}/secrets.json"
info "Loading secrets config: ${SECRETS_CONFIG}"
SECRETS_JSON=$(load_json_config "$SECRETS_CONFIG") || exit 1

PROJECT_ID=$(echo "$SECRETS_JSON" | jqr -r '.project_id')
info "GCP Project: ${PROJECT_ID}"

# Resolve project number for IAM bindings
PROJECT_NUMBER=$(get_project_number "$PROJECT_ID")
if [ -z "$PROJECT_NUMBER" ]; then
  error "Could not resolve project number for: ${PROJECT_ID}"
  exit 1
fi
info "Project Number: ${PROJECT_NUMBER}"

# Resolve IAM members (replace PROJECT_NUMBER placeholder)
DEFAULT_IAM_MEMBERS=$(echo "$SECRETS_JSON" | jqr -r \
  --arg pn "$PROJECT_NUMBER" \
  '.iam_members // [] | .[] | gsub("PROJECT_NUMBER"; $pn)')

COMPUTE_SA="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo ""

if [ "$AUDIT_ONLY" = "true" ]; then
  header "Audit Mode (read-only)"
fi

# ──────────────────────────────────────────────
# Process each secret
# ──────────────────────────────────────────────

reset_counters

SECRET_COUNT=$(echo "$SECRETS_JSON" | jqr '.secrets | length')
info "Processing ${SECRET_COUNT} secrets..."
echo ""

for i in $(seq 0 $((SECRET_COUNT - 1))); do
  secret_name=$(echo "$SECRETS_JSON" | jqr -r ".secrets[$i].name")
  secret_desc=$(echo "$SECRETS_JSON" | jqr -r ".secrets[$i].description")
  auto_generate=$(echo "$SECRETS_JSON" | jqr -r ".secrets[$i].auto_generate // false")
  generate_length=$(echo "$SECRETS_JSON" | jqr -r ".secrets[$i].generate_length // 32")

  echo "─── Secret: ${secret_name} ───"
  info "Description: ${secret_desc}"

  # Check if secret exists
  if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &>/dev/null; then
    success "Exists: ${secret_name}"

    # Get version count
    version_count=$(gcloud secrets versions list "$secret_name" \
      --project="$PROJECT_ID" \
      --format="value(name)" 2>/dev/null | wc -l | tr -d ' ')
    info "  Versions: ${version_count}"

    # Check IAM bindings
    has_compute_access=$(gcloud secrets get-iam-policy "$secret_name" \
      --project="$PROJECT_ID" \
      --format="json" 2>/dev/null | \
      jqr --arg sa "$COMPUTE_SA" \
      '[.bindings[]? | select(.role == "roles/secretmanager.secretAccessor") | .members[]? | select(. == $sa)] | length > 0')

    if [ "$has_compute_access" = "true" ]; then
      success "  IAM: Compute SA has secretAccessor"
    else
      warn "  IAM: Compute SA missing secretAccessor"
      if [ "$AUDIT_ONLY" = "false" ]; then
        grant_secret_access "$secret_name" "$COMPUTE_SA" "$PROJECT_ID"
      fi
    fi

    count_pass
  else
    if [ "$AUDIT_ONLY" = "true" ]; then
      error "Missing: ${secret_name}"
      count_fail
    else
      # Create the secret
      info "Creating secret: ${secret_name}"
      ensure_secret "$secret_name" "$PROJECT_ID"
      count_created

      # Set initial value if available via environment variable
      # Convention: SECRET_DB_PASSWORD for secret "db-password"
      env_var_name="SECRET_$(echo "$secret_name" | tr '[:lower:]-' '[:upper:]_')"
      env_value="${!env_var_name:-}"

      if [ -n "$env_value" ]; then
        set_secret_value "$secret_name" "$env_value" "$PROJECT_ID"
        info "  Initial value set from env var: ${env_var_name}"
      elif [ "$auto_generate" = "true" ]; then
        # Generate a random value
        generated=$(openssl rand -base64 "$generate_length" | tr -d '=/+' | head -c "$generate_length")
        set_secret_value "$secret_name" "$generated" "$PROJECT_ID"
        info "  Auto-generated value (${generate_length} chars)"
      else
        warn "  No value set — provide via env var ${env_var_name} or set manually"
      fi

      # Grant IAM access
      grant_secret_access "$secret_name" "$COMPUTE_SA" "$PROJECT_ID"
      for member in $DEFAULT_IAM_MEMBERS; do
        if [ "$member" != "$COMPUTE_SA" ]; then
          grant_secret_access "$secret_name" "$member" "$PROJECT_ID"
        fi
      done

      # Grant additional IAM members from config
      extra_members=$(echo "$SECRETS_JSON" | jqr -r ".secrets[$i].iam_members // [] | .[]")
      for member in $extra_members; do
        # Replace PROJECT_NUMBER placeholder
        member="${member//PROJECT_NUMBER/$PROJECT_NUMBER}"
        grant_secret_access "$secret_name" "$member" "$PROJECT_ID"
      done
    fi
  fi

  echo ""
done

# ──────────────────────────────────────────────
# Audit Report
# ──────────────────────────────────────────────

header "Secret Manager Report"

echo "  Project:     ${PROJECT_ID}"
echo "  Compute SA:  ${COMPUTE_SA}"
echo ""

# List all secrets with status
info "Secret inventory:"
gcloud secrets list --project="$PROJECT_ID" \
  --format="table(name,createTime.date('%Y-%m-%d'),replication.automatic)" \
  2>/dev/null || warn "Could not list secrets"

echo ""
print_summary

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
