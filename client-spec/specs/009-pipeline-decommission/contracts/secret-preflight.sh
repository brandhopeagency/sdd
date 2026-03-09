#!/usr/bin/env bash
# ============================================================================
# GCP Secret Manager Pre-flight Validation
# ============================================================================
# Run this step BEFORE `gcloud run deploy` to catch missing/empty secrets.
#
# Usage in GitHub Actions:
#   - name: Validate GCP secrets
#     run: bash .github/scripts/secret-preflight.sh
#     env:
#       GCP_PROJECT: ${{ vars.GCP_PROJECT_ID }}
#       CLOUD_RUN_SA: 942889188964-compute@developer.gserviceaccount.com
#
# Or inline:
#   - name: Validate GCP secrets
#     run: |
#       SECRETS="database-url jwt-secret jwt-refresh-secret gmail-client-secret gmail-refresh-token"
#       ... (see below)
# ============================================================================

set -euo pipefail

PROJECT="${GCP_PROJECT:-mental-help-global-25}"
SA="${CLOUD_RUN_SA:-942889188964-compute@developer.gserviceaccount.com}"

# Secrets referenced in `gcloud run deploy --set-secrets`
SECRETS=(
  "database-url"
  "jwt-secret"
  "jwt-refresh-secret"
  "gmail-client-secret"
  "gmail-refresh-token"
)

ERRORS=0

echo "=== GCP Secret Pre-flight Check ==="
echo "Project: $PROJECT"
echo "Service Account: $SA"
echo ""

for secret in "${SECRETS[@]}"; do
  # Check if secret exists and has at least one enabled version
  VERSION_COUNT=$(gcloud secrets versions list "$secret" \
    --project="$PROJECT" \
    --filter="state=ENABLED" \
    --format="value(name)" 2>/dev/null | wc -l || echo "0")

  if [ "$VERSION_COUNT" -eq 0 ]; then
    echo "::error::Secret '$secret' has no active versions in project '$PROJECT'"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ $secret ($VERSION_COUNT active version(s))"
  fi
done

echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo "::error::$ERRORS secret(s) failed validation. Fix with:"
  echo '  echo "value" | gcloud secrets versions add SECRET_NAME --data-file=- --project='"$PROJECT"
  echo '  gcloud secrets add-iam-policy-binding SECRET_NAME --project='"$PROJECT"' \'
  echo '    --member="serviceAccount:'"$SA"'" --role="roles/secretmanager.secretAccessor"'
  exit 1
fi

echo "All $((${#SECRETS[@]})) secrets validated successfully."
