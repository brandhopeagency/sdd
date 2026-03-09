#!/bin/bash
#
# GitHub Infrastructure Setup Script
#
# Configures all MentalHelpGlobal GitHub repositories with:
#   - Environments (dev, prod)
#   - Environment secrets (synced from Google Secret Manager)
#   - Environment variables (from config files)
#   - Branch protection rules (develop, main)
#
# Prerequisites:
#   - gh CLI installed and authenticated with admin:org scope
#   - gcloud CLI installed and authenticated (for Secret Manager reads)
#   - jq installed
#
# Usage:
#   ./setup-github.sh               # Configure all repositories
#   ./setup-github.sh --repo NAME   # Configure a single repository
#
# All operations are idempotent — safe to re-run.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

# ──────────────────────────────────────────────
# Parse arguments
# ──────────────────────────────────────────────

TARGET_REPO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      TARGET_REPO="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--repo REPO_NAME]"
      echo ""
      echo "Options:"
      echo "  --repo NAME   Configure a single repository instead of all"
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

header "GitHub Infrastructure Setup"

info "Checking prerequisites..."
check_gh || exit 1
check_jq || exit 1
check_gh_auth || exit 1

# gcloud is optional (only needed if syncing secrets from Secret Manager)
GCLOUD_AVAILABLE=false
if command -v gcloud &>/dev/null; then
  if gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -n1 | grep -q .; then
    GCLOUD_AVAILABLE=true
    success "gcloud available for Secret Manager reads"
  else
    warn "gcloud installed but not authenticated — secrets from Secret Manager will be skipped"
  fi
else
  warn "gcloud not available — secrets from Secret Manager will be skipped"
fi

echo ""

# ──────────────────────────────────────────────
# Load configuration
# ──────────────────────────────────────────────

REPOS_CONFIG="${CONFIG_DIR}/github-repos.json"
info "Loading repository config: ${REPOS_CONFIG}"
REPOS_JSON=$(load_json_config "$REPOS_CONFIG") || exit 1

ORG=$(echo "$REPOS_JSON" | jqr -r '.organization')
info "Organization: ${ORG}"

# Load environment configs
declare -A ENV_CONFIGS
for env_file in "${CONFIG_DIR}/github-envs"/*.json; do
  if [ -f "$env_file" ]; then
    env_name=$(jqr -r '.name' "$env_file")
    ENV_CONFIGS["$env_name"]=$(tr -d '\r' < "$env_file")
    info "Loaded environment config: ${env_name}"
  fi
done

echo ""

# ──────────────────────────────────────────────
# Functions
# ──────────────────────────────────────────────

# Create or update a GitHub environment
setup_environment() {
  local org="$1" repo="$2" env_name="$3"

  info "  Creating environment: ${env_name}"
  if with_retry 3 gh api --method PUT \
    "repos/${org}/${repo}/environments/${env_name}" \
    --silent 2>/dev/null; then
    success "  Environment created/verified: ${env_name}"
  else
    error "  Failed to create environment: ${env_name}"
    count_fail
    return 1
  fi

  # Apply protection rules if defined
  local env_config="${ENV_CONFIGS[$env_name]:-}"
  if [ -n "$env_config" ]; then
    local has_protection
    has_protection=$(echo "$env_config" | jqr 'has("protection_rules")')
    if [ "$has_protection" = "true" ]; then
      local protection_payload
      protection_payload=$(echo "$env_config" | jqr '{
        wait_timer: (.protection_rules.wait_timer // 0),
        reviewers: (.protection_rules.reviewers // []),
        deployment_branch_policy: null
      }')
      if with_retry 3 gh api --method PUT \
        "repos/${org}/${repo}/environments/${env_name}" \
        --input - <<< "$protection_payload" \
        --silent 2>/dev/null; then
        success "  Protection rules applied: ${env_name}"
      else
        warn "  Could not apply protection rules: ${env_name}"
        count_warn
      fi
    fi
  fi

  count_pass
}

# Set environment secrets from config
setup_env_secrets() {
  local org="$1" repo="$2" env_name="$3"
  local env_config="${ENV_CONFIGS[$env_name]:-}"

  if [ -z "$env_config" ]; then
    warn "  No config found for environment: ${env_name}"
    return 0
  fi

  local secrets_count
  secrets_count=$(echo "$env_config" | jqr '.secrets | length')

  if [ "$secrets_count" -eq 0 ]; then
    info "  No secrets defined for environment: ${env_name}"
    return 0
  fi

  info "  Setting ${secrets_count} secrets for ${env_name}..."

  echo "$env_config" | jqr -r '.secrets | to_entries[] | "\(.key)\t\(.value)"' | while IFS=$'\t' read -r secret_name source; do
    local value=""

    if [[ "$source" == sm:* ]]; then
      # Source from Secret Manager
      if [ "$GCLOUD_AVAILABLE" = "true" ]; then
        local sm_parts
        IFS=':' read -ra sm_parts <<< "${source#sm:}"
        local sm_name="${sm_parts[0]}"
        local sm_transform="${sm_parts[1]:-none}"

        value=$(gcloud secrets versions access latest \
          --secret="$sm_name" \
          --project="${DEFAULT_GCP_PROJECT}" 2>/dev/null) || true

        if [ -z "$value" ]; then
          warn "    Secret ${sm_name} has no value in Secret Manager — skipping ${secret_name}"
          count_skip
          continue
        fi

        # Apply transformations
        if [ "$sm_transform" = "database_url" ]; then
          local db_host db_name
          db_host=$(echo "$env_config" | jqr -r '.variables.CLOUD_SQL_CONNECTION // empty')
          db_name="chat_db"
          value="postgresql://postgres:${value}@/${db_name}?host=/cloudsql/${db_host}"
        fi
      else
        warn "    Skipping Secret Manager source for ${secret_name} (gcloud not available)"
        count_skip
        continue
      fi
    else
      # Literal value
      value="$source"
    fi

    if [ -n "$value" ]; then
      if with_retry 3 gh secret set "$secret_name" \
        --repo "${org}/${repo}" \
        --env "$env_name" \
        --body "$value" 2>/dev/null; then
        success "    Secret set: ${secret_name}"
        count_pass
      else
        error "    Failed to set secret: ${secret_name}"
        count_fail
      fi
    fi
  done
}

# Set environment variables from config
setup_env_variables() {
  local org="$1" repo="$2" env_name="$3"
  local env_config="${ENV_CONFIGS[$env_name]:-}"

  if [ -z "$env_config" ]; then
    return 0
  fi

  local vars_count
  vars_count=$(echo "$env_config" | jqr '.variables | length')

  if [ "$vars_count" -eq 0 ]; then
    info "  No variables defined for environment: ${env_name}"
    return 0
  fi

  info "  Setting ${vars_count} variables for ${env_name}..."

  echo "$env_config" | jqr -r '.variables | to_entries[] | "\(.key)\t\(.value)"' | while IFS=$'\t' read -r var_name var_value; do
    if with_retry 3 gh variable set "$var_name" \
      --repo "${org}/${repo}" \
      --env "$env_name" \
      --body "$var_value" 2>/dev/null; then
      success "    Variable set: ${var_name}"
      count_pass
    else
      error "    Failed to set variable: ${var_name}"
      count_fail
    fi
  done
}

# Configure branch protection
setup_branch_protection() {
  local org="$1" repo="$2" branch="$3"

  # Get defaults from config
  local defaults
  defaults=$(echo "$REPOS_JSON" | jqr '.branch_protection_defaults // {}')

  local require_pr dismiss_stale enforce_admins allow_force allow_delete conv_resolution
  require_pr=$(echo "$defaults" | jqr '.require_pr // true')
  dismiss_stale=$(echo "$defaults" | jqr '.dismiss_stale_reviews // true')
  enforce_admins=$(echo "$defaults" | jqr '.enforce_admins // true')
  allow_force=$(echo "$defaults" | jqr '.allow_force_push // false')
  allow_delete=$(echo "$defaults" | jqr '.allow_deletions // false')
  conv_resolution=$(echo "$defaults" | jqr '.required_conversation_resolution // true')
  local required_approvals
  required_approvals=$(echo "$defaults" | jqr '.required_approvals // 1')

  info "  Configuring branch protection: ${branch}"

  local payload
  payload=$(jqr -n \
    --argjson require_pr "$require_pr" \
    --argjson dismiss_stale "$dismiss_stale" \
    --argjson enforce_admins "$enforce_admins" \
    --argjson allow_force "$allow_force" \
    --argjson allow_delete "$allow_delete" \
    --argjson conv_resolution "$conv_resolution" \
    --argjson required_approvals "$required_approvals" \
    '{
      required_status_checks: null,
      enforce_admins: $enforce_admins,
      required_pull_request_reviews: (
        if $require_pr then {
          dismiss_stale_reviews: $dismiss_stale,
          required_approving_review_count: $required_approvals
        } else null end
      ),
      restrictions: null,
      allow_force_pushes: $allow_force,
      allow_deletions: $allow_delete,
      required_conversation_resolution: $conv_resolution
    }')

  if with_retry 3 gh api --method PUT \
    "repos/${org}/${repo}/branches/${branch}/protection" \
    --input - <<< "$payload" \
    --silent 2>/dev/null; then
    success "  Branch protection set: ${branch}"
    count_pass
  else
    # Branch might not exist yet — this is a warning, not a failure
    warn "  Could not set branch protection on ${branch} (branch may not exist)"
    count_warn
  fi
}

# ──────────────────────────────────────────────
# Main loop: configure repositories
# ──────────────────────────────────────────────

reset_counters

REPO_COUNT=$(echo "$REPOS_JSON" | jqr '.repositories | length')

for i in $(seq 0 $((REPO_COUNT - 1))); do
  repo_name=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].name")
  has_deployments=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].has_deployments // false")
  environments=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].environments // [] | .[]" 2>/dev/null)
  branches=$(echo "$REPOS_JSON" | jqr -r ".repositories[$i].branch_protection // [] | .[]" 2>/dev/null)

  # Filter to single repo if --repo was specified
  if [ -n "$TARGET_REPO" ] && [ "$repo_name" != "$TARGET_REPO" ]; then
    continue
  fi

  echo ""
  header "Repository: ${ORG}/${repo_name}"

  # Check if repo exists
  if ! check_repo_exists "$ORG" "$repo_name"; then
    warn "Repository not found: ${ORG}/${repo_name} — skipping"
    count_skip
    continue
  fi

  # Configure environments (only for repos with deployments)
  if [ "$has_deployments" = "true" ] && [ -n "$environments" ]; then
    info "Setting up environments..."
    for env_name in $environments; do
      setup_environment "$ORG" "$repo_name" "$env_name"
      setup_env_secrets "$ORG" "$repo_name" "$env_name"
      setup_env_variables "$ORG" "$repo_name" "$env_name"
    done
  else
    info "No deployments configured — skipping environments"
  fi

  # Configure branch protection (for ALL repos)
  if [ -n "$branches" ]; then
    info "Setting up branch protection..."
    for branch in $branches; do
      setup_branch_protection "$ORG" "$repo_name" "$branch"
    done
  fi

  success "Repository configured: ${repo_name}"
done

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────

header "GitHub Setup Complete"
print_summary

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
