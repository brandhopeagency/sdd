# Implementation Plan: Cloud & GitHub Infrastructure Setup

**Branch**: `003-cloud-github-infra` | **Date**: 2026-02-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-cloud-github-infra/spec.md`

## Summary

Codify GitHub infrastructure and Secret Manager management as
reproducible, idempotent Bash scripts. GitHub environments, secrets,
variables, and branch protection for all 8 project repositories will
be configured via `gh` CLI. Secret Manager will be consolidated to
cover all application secrets (including currently-undocumented Gmail
OAuth credentials). A unified entrypoint orchestrates both, and a
verification script audits infrastructure state.

Core GCP resources (Cloud SQL, Cloud Run, GCS, Artifact Registry,
Vertex AI, Dialogflow) are already provisioned and out of scope.

## Technical Context

**Language/Version**: Bash (POSIX-compatible shell scripts); aligns
with existing `chat-infra/scripts/*.sh`
**Primary Dependencies**: `gcloud` CLI (Secret Manager, IAM), `gh` CLI
(repos, environments, secrets, variables, branch protection), `jq`
(JSON parsing)
**Storage**: Google Secret Manager (secrets), GitHub API (repository
configuration)
**Testing**: ShellCheck linting (existing CI in `chat-infra`);
verification script for infrastructure state
**Target Platform**: Linux, macOS, Windows (WSL/Git Bash)
**Project Type**: Infrastructure scripts (single project, no
frontend/backend split)
**Performance Goals**: Full setup completes in <15 minutes for all
8 repositories
**Constraints**: All scripts MUST be idempotent; must work with service
account authentication (no interactive prompts in automated mode)
**Scale/Scope**: 8 GitHub repositories, 6 Secret Manager secrets,
7 GitHub Secrets (per-env), 17 GitHub Variables (per-env),
2 environments (dev, prod), 2 protected branches (develop, main)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicable? | Status | Notes |
|-----------|-------------|--------|-------|
| I. Spec-First Development | Yes | PASS | spec.md created and validated before planning |
| II. Multi-Repository Orchestration | Yes | PASS | Targets chat-infra (split) and chat-client/infra/ (monorepo); cross-repo dependencies documented below |
| III. Test-Aligned Development | Partial | PASS | ShellCheck CI exists in chat-infra; verification script provides functional testing; no unit test framework needed for Bash scripts |
| IV. Branch and Integration Discipline | Yes | PASS | Feature branch `003-cloud-github-infra` created; matching branches needed in chat-infra and chat-client |
| V. Privacy and Security First | Yes | PASS | Core feature IS secrets management; no PII in scripts; secrets never logged or echoed |
| VI. Accessibility and Internationalization | No | N/A | Infrastructure scripts, no user-facing UI |
| VII. Dual-Target Implementation | Yes | PASS | Scripts MUST exist in both `chat-infra/scripts/` and `chat-client/infra/scripts/`; config files in both `chat-infra/config/` and `chat-client/infra/config/` |
| VIII. GCP CLI Infrastructure Management | Yes | PASS | All Secret Manager operations via `gcloud` CLI; all commands scripted and committed; scripts target `mental-help-global-25` explicitly |

## Project Structure

### Documentation (this feature)

```text
specs/003-cloud-github-infra/
├── plan.md              # This file
├── research.md          # Phase 0: CLI capabilities, idempotency patterns
├── data-model.md        # Phase 1: Configuration entities and schemas
├── quickstart.md        # Phase 1: How to run the scripts
├── contracts/           # Phase 1: Configuration file schemas (JSON)
│   ├── secrets-config.schema.json
│   └── github-config.schema.json
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (target repositories)

```text
chat-infra/                           # Split repo (canonical for infra)
├── scripts/
│   ├── setup.sh                      # EXISTING — GCP core resources
│   ├── setup-db.sh                   # EXISTING — Cloud SQL + partial secrets
│   ├── setup-storage.sh              # EXISTING — GCS bucket
│   ├── setup-vertex-ai.sh            # EXISTING — Vertex AI
│   ├── setup-secrets.sh              # NEW — Secret Manager consolidation
│   ├── setup-github.sh               # NEW — GitHub infrastructure via gh CLI
│   ├── setup-all.sh                  # NEW — Unified entrypoint
│   ├── verify.sh                     # NEW — Infrastructure verification
│   └── lib/
│       └── common.sh                 # NEW — Shared functions (logging, checks)
├── config/
│   ├── secrets.json                  # NEW — Master secrets list
│   ├── github-repos.json             # NEW — Repository list + settings
│   └── github-envs/
│       ├── dev.json                  # NEW — Dev environment secrets/variables
│       └── prod.json                 # NEW — Prod environment secrets/variables
└── README.md                         # EXISTING — Update with new scripts

chat-client/infra/                    # Monorepo equivalent
├── scripts/
│   ├── setup-secrets.sh              # COPY — Same as chat-infra
│   ├── setup-github.sh               # COPY — Same as chat-infra
│   ├── setup-all.sh                  # COPY — Same as chat-infra
│   ├── verify.sh                     # COPY — Same as chat-infra
│   └── lib/
│       └── common.sh                 # COPY — Same as chat-infra
├── config/
│   ├── secrets.json                  # COPY — Same as chat-infra
│   ├── github-repos.json             # COPY — Same as chat-infra
│   └── github-envs/
│       ├── dev.json                  # COPY — Same as chat-infra
│       └── prod.json                 # COPY — Same as chat-infra
└── README.md                         # EXISTING — Update
```

**Structure Decision**: Infrastructure scripts follow the existing
pattern in `chat-infra/scripts/`. New scripts are added alongside
existing ones (not replacing them). Configuration is externalized into
JSON files under `config/` to keep scripts generic and data-driven.
Per constitution Principle VII, identical copies are maintained in
`chat-client/infra/`.

## Cross-Repository Dependencies

| Order | Repository | Action | Depends On |
|-------|-----------|--------|------------|
| 1 | `chat-infra` | Add new scripts + config files | Nothing (canonical source) |
| 2 | `chat-client` | Copy scripts + config to `infra/` | chat-infra scripts finalized |
| 3 | All 8 repos | Run `setup-github.sh` to configure | Scripts committed, gh CLI authenticated |

No type changes (`chat-types`) or CI workflow changes (`chat-ci`)
are required for this feature.

## Secrets Inventory

### Google Secret Manager (source of truth)

| Secret Name | Status | Created By | Used By |
|------------|--------|------------|---------|
| `db-password` | EXISTS | `setup-db.sh` | Cloud Run backend |
| `jwt-secret` | EXISTS | `setup-db.sh` | Cloud Run backend |
| `jwt-refresh-secret` | EXISTS | `setup-db.sh` | Cloud Run backend |
| `gmail-client-id` | MISSING | Manual / README | Cloud Run backend |
| `gmail-client-secret` | MISSING | Manual / README | Cloud Run backend |
| `gmail-refresh-token` | MISSING | Manual / README | Cloud Run backend |

### GitHub Secrets (per-environment, synced from Secret Manager)

| GitHub Secret | Source | Environments |
|--------------|--------|--------------|
| `GCP_WIF_PROVIDER` | WIF setup output | dev, prod |
| `DATABASE_URL` | Constructed from `db-password` + connection info | dev, prod |
| `JWT_SECRET` | Secret Manager `jwt-secret` | dev, prod |
| `JWT_REFRESH_SECRET` | Secret Manager `jwt-refresh-secret` | dev, prod |
| `GMAIL_CLIENT_SECRET` | Secret Manager `gmail-client-secret` | dev, prod |
| `GMAIL_REFRESH_TOKEN` | Secret Manager `gmail-refresh-token` | dev, prod |
| `GCP_SA_KEY` | Legacy (service account JSON key) | dev, prod |

### GitHub Variables (per-environment, non-sensitive config)

| GitHub Variable | Dev Value | Prod Value |
|----------------|-----------|------------|
| `GCP_PROJECT_ID` | `mental-help-global-25` | `mental-help-global-25` |
| `GCP_SERVICE_ACCOUNT` | `github-actions-sa@mental-help-global-25.iam.gserviceaccount.com` | Same |
| `BACKEND_URL` | `https://chat-backend-dev-....run.app` | `https://chat-backend-....run.app` |
| `FRONTEND_URL` | `https://storage.googleapis.com/mental-help-global-25-dev-frontend` | `https://storage.googleapis.com/mental-help-global-25-frontend` |
| `GCS_BUCKET` | `mental-help-global-25-dev-frontend` | `mental-help-global-25-frontend` |
| `GCS_BUCKET_NAME` | `mental-help-global-25-chat-conversations` | Same |
| `CLOUD_SQL_CONNECTION` | `mental-help-global-25:europe-west1:chat-db` | Same |
| `VERTEX_MODEL` | `publishers/google/models/gemini-2.5-flash-lite` | Same |
| `VERTEX_LOCATION` | `us-central1` | Same |
| `VERTEX_PROJECT_ID` | `mental-help-global-25` | Same |
| `DIALOGFLOW_PROJECT_ID` | `mental-help-global-25` | Same |
| `DIALOGFLOW_AGENT_ID` | (agent UUID) | Same |
| `DIALOGFLOW_LOCATION` | `global` | Same |
| `LLM_PROVIDER` | `vertex` | Same |
| `EMAIL_PROVIDER` | `gmail` | Same |
| `EMAIL_FROM` | (sender address) | Same |
| `GMAIL_CLIENT_ID` | (OAuth client ID) | Same |

## Script Design

### `lib/common.sh` — Shared Functions

- Colored logging (`info`, `warn`, `error`, `success`)
- Prerequisite checks (`check_gcloud`, `check_gh`, `check_jq`)
- Authentication validation (`check_gcloud_auth`, `check_gh_auth`)
- Config file loading (`load_json_config`)
- Idempotent secret creation (`ensure_secret`)
- Script directory resolution (`SCRIPT_DIR`)

### `setup-secrets.sh` — Secret Manager Consolidation

1. Source `lib/common.sh`
2. Load `config/secrets.json` for master list
3. Check prerequisites (gcloud auth, Secret Manager API)
4. For each secret in master list:
   - Check if exists (`gcloud secrets describe`)
   - Create if missing (`gcloud secrets create`)
   - Optionally set initial value if provided via env var or prompt
5. Grant IAM access to Cloud Run compute service account
6. Output audit report (existing, created, missing values)

### `setup-github.sh` — GitHub Infrastructure

1. Source `lib/common.sh`
2. Load `config/github-repos.json` for repository list
3. Load `config/github-envs/{dev,prod}.json` for env config
4. Check prerequisites (gh auth, org admin access)
5. For each repository:
   a. Create environments (`gh api --method PUT`)
   b. Set secrets per environment (`gh secret set --env`)
   c. Set variables per environment (`gh variable set --env`)
   d. Configure branch protection (`gh api --method PUT`)
6. All operations are naturally idempotent (PUT = upsert)

### `setup-all.sh` — Unified Entrypoint

1. Source `lib/common.sh`
2. Check ALL prerequisites upfront (gcloud + gh + jq)
3. Run `setup-secrets.sh`
4. Read secrets from Secret Manager
5. Run `setup-github.sh` (passing secret values)
6. Run `verify.sh`
7. Report summary

### `verify.sh` — Infrastructure Verification

1. Source `lib/common.sh`
2. Check Secret Manager inventory against `config/secrets.json`
3. Check GitHub environments exist for all repos
4. Check GitHub secrets/variables match config
5. Check branch protection rules on develop and main
6. Output pass/fail report per component

## Complexity Tracking

> No constitution violations. All principles either pass or are N/A.

## Implementation Notes

- **Idempotency**: `gh` operations (PUT, secret set, variable set) are
  naturally idempotent. `gcloud secrets create` requires
  check-before-create pattern. IAM bindings are additive and safe.
- **Secret values**: Scripts never echo or log secret values. Values
  are piped via stdin (`--data-file=-`) to avoid shell history exposure.
- **Config-driven**: All repository names, secret names, and variable
  values are externalized into JSON config files. Scripts read config
  and apply desired state.
- **Existing scripts untouched**: `setup.sh`, `setup-db.sh`,
  `setup-storage.sh`, `setup-vertex-ai.sh` remain as-is. New scripts
  complement them.
- **GCP_SA_KEY deprecation**: The legacy `GCP_SA_KEY` secret is
  included for backward compatibility but should be deprecated in
  favor of Workload Identity Federation.
