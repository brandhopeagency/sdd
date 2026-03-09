# Research: Cloud & GitHub Infrastructure Setup

**Feature**: 003-cloud-github-infra
**Date**: 2026-02-08

## R1: GitHub CLI Capabilities for Infrastructure Management

### Decision

Use `gh` CLI with direct API calls (`gh api`) for environment and branch
protection management, and built-in `gh secret set` / `gh variable set`
commands for secrets and variables.

### Rationale

- `gh secret set` and `gh variable set` are natively idempotent
  (create-or-update semantics)
- `gh api --method PUT` for environments and branch protection uses
  HTTP PUT which is inherently idempotent (upsert)
- No third-party tools or wrappers needed
- `gh` CLI is already required for GitHub Packages access in the
  project's CI workflows

### Alternatives Considered

| Alternative | Rejected Because |
|------------|-----------------|
| GitHub Terraform provider | Adds Terraform dependency; overkill for declarative config that changes rarely; Terraform migration is explicitly out of scope |
| GitHub REST API via `curl` | Requires manual token management and encryption for secrets; `gh` handles auth and encryption transparently |
| GitHub Actions for self-configuration | Circular dependency (need GitHub configured to run Actions); not suitable for initial setup |

### Key Commands

| Operation | Command | Idempotent |
|-----------|---------|------------|
| Create environment | `gh api --method PUT repos/{o}/{r}/environments/{env}` | Yes (PUT) |
| Set environment secret | `gh secret set NAME --env ENV --body VALUE` | Yes (upsert) |
| Set environment variable | `gh variable set NAME --env ENV --body VALUE` | Yes (upsert) |
| Set branch protection | `gh api --method PUT repos/{o}/{r}/branches/{branch}/protection --input config.json` | Yes (PUT) |
| List secrets | `gh secret list --env ENV` | Read-only |
| List variables | `gh variable list --env ENV` | Read-only |
| List environments | `gh api repos/{o}/{r}/environments --jq '.environments[].name'` | Read-only |

## R2: gcloud Secret Manager Idempotency Patterns

### Decision

Use a check-before-create pattern for `gcloud secrets create` (which
errors on duplicates) and treat `gcloud secrets versions add` as the
value-setting mechanism. Compare values before adding versions to avoid
unnecessary version proliferation.

### Rationale

- `gcloud secrets create` returns an error if the secret already exists
  (unlike `gh` commands which upsert)
- `gcloud secrets versions add` always creates a new version, so
  comparing current value prevents unnecessary version growth
- `gcloud secrets add-iam-policy-binding` is idempotent (duplicate
  bindings are no-ops)

### Pattern

```bash
ensure_secret() {
  local name="$1" project="$2"
  if ! gcloud secrets describe "$name" --project="$project" &>/dev/null; then
    gcloud secrets create "$name" \
      --replication-policy="automatic" \
      --project="$project"
  fi
}

set_secret_value() {
  local name="$1" value="$2" project="$3"
  local current
  current=$(gcloud secrets versions access latest \
    --secret="$name" --project="$project" 2>/dev/null) || true
  if [ "$current" != "$value" ]; then
    printf '%s' "$value" | gcloud secrets versions add "$name" \
      --data-file=- --project="$project"
  fi
}
```

### Alternatives Considered

| Alternative | Rejected Because |
|------------|-----------------|
| Always add new version | Creates version bloat on idempotent re-runs |
| Delete and recreate secret | Destroys version history; breaks IAM bindings |
| Use Terraform Secret Manager provider | Terraform migration out of scope |

## R3: Script Language Choice

### Decision

Use Bash for all infrastructure scripts, consistent with the existing
`chat-infra/scripts/*.sh` convention.

### Rationale

- All 4 existing scripts (`setup.sh`, `setup-db.sh`,
  `setup-storage.sh`, `setup-vertex-ai.sh`) are Bash
- ShellCheck linting is already configured in `chat-infra` CI
- `gcloud` and `gh` are CLI tools designed for shell scripting
- Bash runs on Linux, macOS, and Windows (WSL/Git Bash)
- The speckit workflow scripts are PowerShell, but infrastructure
  scripts follow the chat-infra convention

### Alternatives Considered

| Alternative | Rejected Because |
|------------|-----------------|
| PowerShell | Inconsistent with existing chat-infra scripts; less common in DevOps tooling; would require dual maintenance |
| Python | Adds runtime dependency; overkill for CLI wrapper scripts; inconsistent with existing pattern |
| Node.js/TypeScript | Wrong tool for infrastructure automation; adds npm dependency |

## R4: Configuration File Format

### Decision

Use JSON files for declarative configuration (secrets list, repository
list, environment variables). Scripts read these files and apply the
desired state.

### Rationale

- `jq` provides powerful JSON parsing in Bash
- JSON schema validation is well-supported for documentation
- Existing GCP and GitHub APIs use JSON natively
- Configuration changes don't require script modifications
- Machine-readable for verification scripts

### File Structure

```text
config/
├── secrets.json           # Master list of Secret Manager secrets
├── github-repos.json      # List of repos + per-repo settings
└── github-envs/
    ├── dev.json            # Dev environment: secrets + variables
    └── prod.json           # Prod environment: secrets + variables
```

### Alternatives Considered

| Alternative | Rejected Because |
|------------|-----------------|
| YAML | Requires `yq` dependency; not natively supported by gcloud/gh |
| .env files | No support for nested structures; can't represent per-environment configs cleanly |
| Hardcoded in scripts | Makes configuration changes require code changes; harder to audit |

## R5: Existing Secrets Audit

### Decision

The project has 3 secrets already in Secret Manager and 3 that are
documented but not yet created. The new `setup-secrets.sh` script
will ensure all 6 exist.

### Current State

| Secret | In Secret Manager | In README/Docs | Action |
|--------|------------------|----------------|--------|
| `db-password` | Yes | Yes | Keep as-is |
| `jwt-secret` | Yes | Yes | Keep as-is |
| `jwt-refresh-secret` | Yes | Yes | Keep as-is |
| `gmail-client-id` | No | Yes (README) | Create via script |
| `gmail-client-secret` | No | Yes (README) | Create via script |
| `gmail-refresh-token` | No | Yes (README) | Create via script |

### IAM Access

All secrets need `roles/secretmanager.secretAccessor` for the Cloud Run
compute service account:
`{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`

The existing `setup-db.sh` already grants this for the first 3 secrets.
The new script will ensure it for all 6.

## R6: GitHub Variables vs Secrets Classification

### Decision

Separate GitHub configuration into secrets (sensitive, encrypted) and
variables (non-sensitive, plaintext) based on data sensitivity.

### Classification

**Secrets** (encrypted, sourced from Secret Manager or WIF setup):
- `GCP_WIF_PROVIDER` — WIF provider URL (security-sensitive)
- `DATABASE_URL` — Contains password
- `JWT_SECRET` — Signing key
- `JWT_REFRESH_SECRET` — Signing key
- `GMAIL_CLIENT_SECRET` — OAuth secret
- `GMAIL_REFRESH_TOKEN` — OAuth token
- `GCP_SA_KEY` — Legacy service account key

**Variables** (plaintext, non-sensitive configuration):
- `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT`
- `BACKEND_URL`, `FRONTEND_URL`
- `GCS_BUCKET`, `GCS_BUCKET_NAME`
- `CLOUD_SQL_CONNECTION`
- `VERTEX_MODEL`, `VERTEX_LOCATION`, `VERTEX_PROJECT_ID`
- `DIALOGFLOW_PROJECT_ID`, `DIALOGFLOW_AGENT_ID`, `DIALOGFLOW_LOCATION`
- `LLM_PROVIDER`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `GMAIL_CLIENT_ID`

### Rationale

GitHub secrets are write-only (cannot be read back via API), which is
appropriate for sensitive values. Variables can be read back, making
them suitable for non-sensitive configuration that the verification
script needs to audit.

## R7: Repositories Requiring Configuration

### Decision

Configure all 8 repositories in the MentalHelpGlobal organization.
Not all repos need all settings — only repos with CI/CD workflows
need environment-level secrets and variables.

### Repository Configuration Matrix

| Repository | Environments | Secrets | Variables | Branch Protection |
|-----------|--------------|---------|-----------|-------------------|
| `chat-backend` | dev, prod | Yes | Yes | develop, main |
| `chat-frontend` | dev, prod | Yes | Yes | develop, main |
| `chat-client` | dev, prod | Yes | Yes | develop, main |
| `chat-types` | — | — | — | develop, main |
| `chat-ui` | dev, prod | Partial | Partial | develop, main |
| `chat-ci` | — | — | — | develop, main |
| `chat-infra` | — | — | — | develop, main |
| `client-spec` | — | — | — | develop, main |

**Partial**: `chat-ui` needs deployment URLs and GCP credentials for
E2E tests but not all application secrets.
