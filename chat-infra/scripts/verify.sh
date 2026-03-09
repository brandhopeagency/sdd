#!/bin/bash
#
# Infrastructure Verification Script
#
# Audits the current state of:
#   - Google Secret Manager (secrets exist, IAM correct)
#   - GitHub environments (exist for all deployment repos)
#   - GitHub variables (values match config)
#   - Branch protection (develop + main protected)
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - gh CLI installed and authenticated
#   - jq installed
#
# Usage:
#   ./verify.sh
#
# Exit code: 0 if all checks pass, 1 if any fail.
# This script is read-only — it never modifies infrastructure.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

# ──────────────────────────────────────────────
# Prerequisites
# ──────────────────────────────────────────────

header "Infrastructure Verification"

info "Checking prerequisites..."
check_gcloud || exit 1
check_gh || exit 1
check_jq || exit 1
check_gcloud_auth || exit 1
check_gh_auth || exit 1
echo ""

# ──────────────────────────────────────────────
# Load configuration
# ──────────────────────────────────────────────

SECRETS_CONFIG="${CONFIG_DIR}/secrets.json"
REPOS_CONFIG="${CONFIG_DIR}/github-repos.json"

info "Loading configuration files..."
SECRETS_JSON=$(load_json_config "$SECRETS_CONFIG") || exit 1
REPOS_JSON=$(load_json_config "$REPOS_CONFIG") || exit 1

PROJECT_ID=$(echo "$SECRETS_JSON" | jqr -r '.project_id')
ORG=$(echo "$REPOS_JSON" | jqr -r '.organization')
PROJECT_NUMBER=$(get_project_number "$PROJECT_ID")
COMPUTE_SA="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

info "Project: ${PROJECT_ID} (${PROJECT_NUMBER})"
info "Organization: ${ORG}"
echo ""

# Load environment configs
declare -A ENV_CONFIGS
for env_file in "${CONFIG_DIR}/github-envs"/*.json; do
  if [ -f "$env_file" ]; then
    env_name=$(jqr -r '.name' "$env_file")
    ENV_CONFIGS["$env_name"]=$(tr -d '\r' < "$env_file")
  fi
done

reset_counters

# ──────────────────────────────────────────────
# Section 1: Secret Manager Inventory
# ──────────────────────────────────────────────

header "1. Secret Manager Inventory"

SECRET_COUNT=$(echo "$SECRETS_JSON" | jqr '.secrets | length')
info "Checking ${SECRET_COUNT} secrets..."
echo ""

for i in $(seq 0 $((SECRET_COUNT - 1))); do
  secret_name=$(echo "$SECRETS_JSON" | jqr -r ".secrets[$i].name")

  if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &>/dev/null; then
    # Check status (active/disabled)
    local_status=$(gcloud secrets versions list "$secret_name" \
      --project="$PROJECT_ID" \
      --format="value(state)" \
      --limit=1 2>/dev/null || echo "UNKNOWN")

    version_count=$(gcloud secrets versions list "$secret_name" \
      --project="$PROJECT_ID" \
      --format="value(name)" 2>/dev/null | wc -l | tr -d ' ')

    if [ "$local_status" = "ENABLED" ] || [ "$local_status" = "UNKNOWN" ]; then
      success "Secret exists: ${secret_name} (${version_count} versions)"
      count_pass
    elif [ "$local_status" = "DISABLED" ]; then
      warn "Secret DISABLED: ${secret_name}"
      count_warn
    else
      warn "Secret in unexpected state: ${secret_name} (${local_status})"
      count_warn
    fi

    # Check IAM binding
    has_access=$(gcloud secrets get-iam-policy "$secret_name" \
      --project="$PROJECT_ID" \
      --format="json" 2>/dev/null | \
      jqr --arg sa "$COMPUTE_SA" \
      '[.bindings[]? | select(.role == "roles/secretmanager.secretAccessor") | .members[]? | select(. == $sa)] | length > 0')

    if [ "$has_access" = "true" ]; then
      success "  IAM OK: Compute SA has access"
      count_pass
    else
      error "  IAM FAIL: Compute SA missing secretAccessor"
      count_fail
    fi
  else
    error "Secret MISSING: ${secret_name}"
    count_fail
  fi
done

echo ""

# ──────────────────────────────────────────────
# Section 2: GitHub Environments
# ──────────────────────────────────────────────

header "2. GitHub Environments"

REPO_COUNT=$(echo "$REPOS_JSON" | jqr '.repositories | length')

for i in $(seq 0 $((REPO_COUNT - 1))); do
  repo_name=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].name")
  has_deployments=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].has_deployments // false")

  if [ "$has_deployments" != "true" ]; then
    continue
  fi

  info "Repository: ${ORG}/${repo_name}"

  # Check repo exists
  if ! check_repo_exists "$ORG" "$repo_name"; then
    error "  Repository not found: ${ORG}/${repo_name}"
    count_fail
    continue
  fi

  # Check environments
  local_envs=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].environments // [] | .[]")
  for env_name in $local_envs; do
    if gh api "repos/${ORG}/${repo_name}/environments/${env_name}" --jq '.name' &>/dev/null; then
      success "  Environment exists: ${env_name}"
      count_pass
    else
      error "  Environment MISSING: ${env_name}"
      count_fail
    fi
  done
done

echo ""

# ──────────────────────────────────────────────
# Section 3: GitHub Variables
# ──────────────────────────────────────────────

header "3. GitHub Variables"

for i in $(seq 0 $((REPO_COUNT - 1))); do
  repo_name=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].name")
  has_deployments=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].has_deployments // false")

  if [ "$has_deployments" != "true" ]; then
    continue
  fi

  if ! check_repo_exists "$ORG" "$repo_name"; then
    continue
  fi

  local_envs=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].environments // [] | .[]")
  for env_name in $local_envs; do
    env_config="${ENV_CONFIGS[$env_name]:-}"
    if [ -z "$env_config" ]; then
      continue
    fi

    info "  ${repo_name}/${env_name} variables:"

    echo "$env_config" | jqr -r '.variables | to_entries[] | "\(.key)\t\(.value)"' | while IFS=$'\t' read -r var_name expected_value; do
      actual_value=$(gh variable get "$var_name" \
        --repo "${ORG}/${repo_name}" \
        --env "$env_name" 2>/dev/null) || actual_value=""

      if [ "$actual_value" = "$expected_value" ]; then
        success "    ${var_name}: matches"
        count_pass
      elif [ -n "$actual_value" ]; then
        warn "    ${var_name}: DRIFT (expected: ${expected_value}, actual: ${actual_value})"
        count_warn
      else
        error "    ${var_name}: MISSING"
        count_fail
      fi
    done
  done
done

echo ""

# ──────────────────────────────────────────────
# Section 4: Branch Protection
# ──────────────────────────────────────────────

header "4. Branch Protection"

for i in $(seq 0 $((REPO_COUNT - 1))); do
  repo_name=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].name")
  branches=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].branch_protection // [] | .[]")

  if [ -z "$branches" ]; then
    continue
  fi

  if ! check_repo_exists "$ORG" "$repo_name"; then
    error "Repository not found: ${ORG}/${repo_name}"
    count_fail
    continue
  fi

  info "Repository: ${ORG}/${repo_name}"

  for branch in $branches; do
    if gh api "repos/${ORG}/${repo_name}/branches/${branch}/protection" --jq '.url' &>/dev/null; then
      success "  Branch protected: ${branch}"
      count_pass
    else
      error "  Branch NOT protected: ${branch}"
      count_fail
    fi
  done
done

echo ""

# ──────────────────────────────────────────────
# Final Report
# ──────────────────────────────────────────────

header "Verification Report"

TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
echo "  ${TOTAL} checks performed"
echo ""
print_summary

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo ""
  error "Verification FAILED — ${FAIL_COUNT} issue(s) found"
  exit 1
else
  echo ""
  success "Verification PASSED — all checks OK"
  exit 0
fi
