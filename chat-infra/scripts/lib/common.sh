#!/bin/bash
#
# Shared library for MHG infrastructure scripts
#
# Provides:
#   - Colored logging (info, warn, error, success)
#   - Prerequisite checks (gcloud, gh, jq)
#   - Authentication validation
#   - Config file loading (JSON via jq)
#   - Idempotent secret creation helpers
#   - Script directory resolution
#
# Usage: source this file from any script in scripts/
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "${SCRIPT_DIR}/lib/common.sh"
#

# Resolve the directory of the calling script (not this library)
# Callers should set SCRIPT_DIR before sourcing this file
if [ -z "${SCRIPT_DIR:-}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
fi

# Project root is one level up from scripts/
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck disable=SC2034
CONFIG_DIR="${PROJECT_ROOT}/config"

# Default GCP project
DEFAULT_GCP_PROJECT="mental-help-global-25"

# ──────────────────────────────────────────────
# Colored Logging
# ──────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1" >&2
}

success() {
  echo -e "${GREEN}✓${NC} $1"
}

header() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

# ──────────────────────────────────────────────
# Prerequisite Checks
# ──────────────────────────────────────────────

check_gcloud() {
  if ! command -v gcloud &>/dev/null; then
    error "gcloud CLI is not installed. Install: https://cloud.google.com/sdk/docs/install"
    return 1
  fi
  success "gcloud CLI found: $(gcloud version --format='value(Google Cloud SDK)' 2>/dev/null || echo 'unknown version')"
}

check_gh() {
  if ! command -v gh &>/dev/null; then
    error "GitHub CLI (gh) is not installed. Install: https://cli.github.com/"
    return 1
  fi
  success "gh CLI found: $(gh --version | head -n1)"
}

check_jq() {
  if ! command -v jq &>/dev/null; then
    error "jq is not installed. Install: https://jqlang.github.io/jq/download/"
    return 1
  fi
  success "jq found: $(jq --version)"
}

# ──────────────────────────────────────────────
# Authentication Validation
# ──────────────────────────────────────────────

check_gcloud_auth() {
  local account
  account=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -n1)
  if [ -z "$account" ]; then
    error "Not authenticated with gcloud. Run: gcloud auth login"
    return 1
  fi
  success "gcloud authenticated as: ${account}"
}

check_gh_auth() {
  if ! gh auth status &>/dev/null; then
    error "Not authenticated with GitHub CLI. Run: gh auth login"
    return 1
  fi
  local gh_user
  gh_user=$(gh api user --jq '.login' 2>/dev/null || echo "unknown")
  success "gh authenticated as: ${gh_user}"
}

# ──────────────────────────────────────────────
# Cross-platform jq wrapper
# ──────────────────────────────────────────────

# Windows jq outputs \r\n line endings. This wrapper strips carriage
# returns so all downstream processing works on Unix-style \n lines.
# Usage: identical to jq — e.g. jqr -r '.name' file.json
jqr() {
  jq "$@" | tr -d '\r'
}

# ──────────────────────────────────────────────
# Config Loading
# ──────────────────────────────────────────────

# Load and validate a JSON config file
# Usage: local config; config=$(load_json_config "path/to/file.json")
# Note: Strips carriage returns for Windows/CRLF compatibility
load_json_config() {
  local config_file="$1"

  if [ ! -f "$config_file" ]; then
    error "Config file not found: ${config_file}"
    return 1
  fi

  # Validate JSON syntax
  if ! jq empty "$config_file" 2>/dev/null; then
    error "Invalid JSON in config file: ${config_file}"
    return 1
  fi

  # Strip carriage returns for Windows CRLF compatibility
  tr -d '\r' < "$config_file"
}

# ──────────────────────────────────────────────
# Secret Manager Helpers
# ──────────────────────────────────────────────

# Ensure a secret exists in Secret Manager (idempotent)
# Usage: ensure_secret "secret-name" "project-id"
ensure_secret() {
  local name="$1"
  local project="${2:-${DEFAULT_GCP_PROJECT}}"

  if gcloud secrets describe "$name" --project="$project" &>/dev/null; then
    info "Secret already exists: ${name}"
    return 0
  fi

  info "Creating secret: ${name}"
  gcloud secrets create "$name" \
    --replication-policy="automatic" \
    --project="$project" \
    --quiet
  success "Created secret: ${name}"
}

# Set a secret value (only if changed to avoid version bloat)
# Usage: set_secret_value "secret-name" "value" "project-id"
# WARNING: Never log the value parameter
set_secret_value() {
  local name="$1"
  local value="$2"
  local project="${3:-${DEFAULT_GCP_PROJECT}}"

  # Check if a version exists and current value matches
  local current
  current=$(gcloud secrets versions access latest \
    --secret="$name" --project="$project" 2>/dev/null) || true

  if [ "$current" = "$value" ]; then
    info "Secret value unchanged: ${name} (skipping)"
    return 0
  fi

  info "Setting secret value: ${name}"
  printf '%s' "$value" | gcloud secrets versions add "$name" \
    --data-file=- \
    --project="$project" \
    --quiet
  success "Secret value set: ${name}"
}

# Grant IAM access to a secret
# Usage: grant_secret_access "secret-name" "member" "project-id"
grant_secret_access() {
  local name="$1"
  local member="$2"
  local project="${3:-${DEFAULT_GCP_PROJECT}}"

  info "Granting secretAccessor on ${name} to ${member}"
  gcloud secrets add-iam-policy-binding "$name" \
    --member="$member" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$project" \
    --quiet &>/dev/null
  success "IAM binding set: ${name} → ${member}"
}

# ──────────────────────────────────────────────
# GCP Helpers
# ──────────────────────────────────────────────

# Get the GCP project number for the given project ID
# Usage: local num; num=$(get_project_number "project-id")
get_project_number() {
  local project="${1:-${DEFAULT_GCP_PROJECT}}"
  gcloud projects describe "$project" --format="value(projectNumber)" 2>/dev/null
}

# Check if a GCP API is enabled
# Usage: check_api_enabled "secretmanager.googleapis.com" "project-id"
check_api_enabled() {
  local api="$1"
  local project="${2:-${DEFAULT_GCP_PROJECT}}"

  if gcloud services list --enabled --project="$project" --filter="config.name:${api}" --format="value(config.name)" 2>/dev/null | grep -q "$api"; then
    return 0
  else
    return 1
  fi
}

# ──────────────────────────────────────────────
# GitHub API Helpers
# ──────────────────────────────────────────────

# Retry a command with exponential backoff (for rate limiting)
# Usage: with_retry 3 gh api ...
with_retry() {
  local max_attempts="$1"
  shift
  local attempt=1
  local wait_time=2

  while [ "$attempt" -le "$max_attempts" ]; do
    if "$@"; then
      return 0
    fi

    if [ "$attempt" -eq "$max_attempts" ]; then
      error "Command failed after ${max_attempts} attempts: $*"
      return 1
    fi

    warn "Attempt ${attempt}/${max_attempts} failed. Retrying in ${wait_time}s..."
    sleep "$wait_time"
    wait_time=$((wait_time * 2))
    attempt=$((attempt + 1))
  done
}

# Check if a GitHub repository exists and is accessible
# Usage: check_repo_exists "org" "repo"
check_repo_exists() {
  local org="$1"
  local repo="$2"

  if gh api "repos/${org}/${repo}" --jq '.name' &>/dev/null; then
    return 0
  else
    return 1
  fi
}

# ──────────────────────────────────────────────
# Counters for summary reports
# ──────────────────────────────────────────────

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
SKIP_COUNT=0
CREATED_COUNT=0

reset_counters() {
  PASS_COUNT=0
  FAIL_COUNT=0
  WARN_COUNT=0
  SKIP_COUNT=0
  CREATED_COUNT=0
}

count_pass() { PASS_COUNT=$((PASS_COUNT + 1)); }
count_fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); }
count_warn() { WARN_COUNT=$((WARN_COUNT + 1)); }
count_skip() { SKIP_COUNT=$((SKIP_COUNT + 1)); }
count_created() { CREATED_COUNT=$((CREATED_COUNT + 1)); }

print_summary() {
  echo ""
  echo "─────────────────────────────────────"
  echo "  Summary"
  echo "─────────────────────────────────────"
  if [ "$PASS_COUNT" -gt 0 ]; then
    echo -e "  ${GREEN}✓ Passed:  ${PASS_COUNT}${NC}"
  fi
  if [ "$CREATED_COUNT" -gt 0 ]; then
    echo -e "  ${GREEN}+ Created: ${CREATED_COUNT}${NC}"
  fi
  if [ "$WARN_COUNT" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Warnings: ${WARN_COUNT}${NC}"
  fi
  if [ "$SKIP_COUNT" -gt 0 ]; then
    echo -e "  ${BLUE}○ Skipped: ${SKIP_COUNT}${NC}"
  fi
  if [ "$FAIL_COUNT" -gt 0 ]; then
    echo -e "  ${RED}✗ Failed:  ${FAIL_COUNT}${NC}"
  fi
  echo "─────────────────────────────────────"
}
