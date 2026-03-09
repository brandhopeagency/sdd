#!/bin/bash
#
# Unified Infrastructure Setup Script
#
# Orchestrates all infrastructure setup in the correct order:
#   1. Secret Manager consolidation (setup-secrets.sh)
#   2. GitHub infrastructure configuration (setup-github.sh)
#   3. Verification (verify.sh)
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - gh CLI installed and authenticated with admin:org scope
#   - jq installed
#
# Usage:
#   ./setup-all.sh
#
# All operations are idempotent — safe to re-run.
# If any step fails, remaining steps still execute.
#

set -uo pipefail
# Note: NOT using set -e here because we want to continue on failure

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

# ──────────────────────────────────────────────
# Prerequisites (check ALL upfront)
# ──────────────────────────────────────────────

header "Unified Infrastructure Setup"

info "Checking all prerequisites upfront..."
echo ""

PREREQ_FAILED=false

if ! check_gcloud; then PREREQ_FAILED=true; fi
if ! check_gh; then PREREQ_FAILED=true; fi
if ! check_jq; then PREREQ_FAILED=true; fi
echo ""
if ! check_gcloud_auth; then PREREQ_FAILED=true; fi
if ! check_gh_auth; then PREREQ_FAILED=true; fi

if [ "$PREREQ_FAILED" = "true" ]; then
  echo ""
  error "Prerequisite check failed. Fix the issues above and re-run."
  exit 1
fi

echo ""
success "All prerequisites satisfied"
echo ""

# ──────────────────────────────────────────────
# Track overall results
# ──────────────────────────────────────────────

STEP_FAILURES=0
STEP_RESULTS=()

run_step() {
  local step_num="$1"
  local step_name="$2"
  local step_script="$3"
  shift 3

  header "Step ${step_num}: ${step_name}"

  if bash "${SCRIPT_DIR}/${step_script}" "$@"; then
    STEP_RESULTS+=("${GREEN}✓${NC} Step ${step_num}: ${step_name}")
    success "Step ${step_num} completed successfully"
  else
    STEP_RESULTS+=("${RED}✗${NC} Step ${step_num}: ${step_name}")
    error "Step ${step_num} failed — continuing with remaining steps"
    STEP_FAILURES=$((STEP_FAILURES + 1))
  fi

  echo ""
}

# ──────────────────────────────────────────────
# Execute steps in order
# ──────────────────────────────────────────────

run_step 1 "Secret Manager Consolidation" "setup-secrets.sh"
run_step 2 "GitHub Infrastructure" "setup-github.sh"
run_step 3 "Verification" "verify.sh"

# ──────────────────────────────────────────────
# Final Summary
# ──────────────────────────────────────────────

header "Setup Complete"

echo "  Step Results:"
echo ""
for result in "${STEP_RESULTS[@]}"; do
  echo -e "  ${result}"
done

echo ""
echo "─────────────────────────────────────"

if [ "$STEP_FAILURES" -eq 0 ]; then
  success "All steps completed successfully!"
  echo ""
  info "Run ./scripts/verify.sh at any time to re-check infrastructure state."
  exit 0
else
  error "${STEP_FAILURES} step(s) failed. Review output above for details."
  echo ""
  info "Fix failures and re-run — all operations are idempotent."
  exit 1
fi
