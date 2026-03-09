# Tasks: Cloud & GitHub Infrastructure Setup

**Input**: Design documents from `/specs/003-cloud-github-infra/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not requested in the feature specification. Verification
script (`verify.sh`) serves as the functional test for this feature.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Split repo (canonical)**: `chat-infra/scripts/`, `chat-infra/config/`
- **Monorepo equivalent**: `chat-client/infra/scripts/`, `chat-client/infra/config/`
- Implementation happens in `chat-infra` first; copied to `chat-client/infra/` in Polish phase

---

## Phase 1: Setup

**Purpose**: Create directory structure and shared library

- [x] T001 Create directory structure in chat-infra: `scripts/lib/`, `config/github-envs/` at `D:\src\MHG\chat-infra`
- [x] T002 Implement shared library in `chat-infra/scripts/lib/common.sh` with functions: colored logging (`info`, `warn`, `error`, `success`), prerequisite checks (`check_gcloud`, `check_gh`, `check_jq`), authentication validation (`check_gcloud_auth`, `check_gh_auth`), config loading (`load_json_config`), idempotent secret creation (`ensure_secret`, `set_secret_value`), and `SCRIPT_DIR` resolution. Reference patterns from `research.md` R2.

---

## Phase 2: Foundational (Configuration Files)

**Purpose**: Declarative JSON config files that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create secrets master list in `chat-infra/config/secrets.json` with all 6 secrets (db-password, jwt-secret, jwt-refresh-secret, gmail-client-id, gmail-client-secret, gmail-refresh-token) per `contracts/secrets-config.schema.json` schema. Include `github_secret_name`, `github_transform`, `auto_generate`, and `iam_members` fields for each.
- [x] T004 [P] Create repository list in `chat-infra/config/github-repos.json` with all 8 repositories (chat-backend, chat-frontend, chat-client, chat-types, chat-ui, chat-ci, chat-infra, client-spec) per `contracts/github-config.schema.json`. Set `has_deployments: true` for chat-backend, chat-frontend, chat-client, chat-ui. Set `branch_protection: ["develop", "main"]` for all. Set `environments: ["dev", "prod"]` for deployment repos only.
- [x] T005 [P] Create dev environment config in `chat-infra/config/github-envs/dev.json` with all 7 GitHub Secrets (sourcing from Secret Manager via `sm:` prefix) and all 17 GitHub Variables with dev-specific values per plan.md Secrets Inventory tables.
- [x] T006 [P] Create prod environment config in `chat-infra/config/github-envs/prod.json` with all 7 GitHub Secrets and all 17 GitHub Variables with prod-specific values. Prod environment MUST include `protection_rules` requiring deployment approval.

**Checkpoint**: All config files ready — user story implementation can begin

---

## Phase 3: User Story 1 - GitHub Infrastructure Configuration (Priority: P1)

**Goal**: A DevOps engineer runs `setup-github.sh` to configure all GitHub repositories with environments, secrets, variables, and branch protection.

**Independent Test**: Run against a single repository (e.g., `chat-backend`) and verify environments, secrets, variables, and branch protection match config files.

### Implementation for User Story 1

- [x] T007 [US1] Implement `chat-infra/scripts/setup-github.sh` with the following capabilities: (1) source `lib/common.sh` and check prerequisites (gh auth, jq), (2) load `config/github-repos.json` and `config/github-envs/*.json`, (3) for each repo with `has_deployments: true`: create environments via `gh api --method PUT`, set environment secrets via `gh secret set --env` (reading values from Secret Manager using `gcloud secrets versions access`), set environment variables via `gh variable set --env`, (4) for ALL repos: configure branch protection on `develop` and `main` via `gh api --method PUT` with JSON payload (require PR reviews, dismiss stale reviews, enforce admins, no force push, no deletions, require conversation resolution), (5) handle edge cases: skip non-existent repos with warning, detect insufficient permissions early, handle GitHub rate limiting with retry logic. All operations are idempotent (PUT = upsert, set = create-or-update). Script MUST accept optional `--repo REPO_NAME` flag to target a single repository.
- [x] T008 [US1] Run `setup-github.sh --repo chat-backend` against `chat-backend` repository and verify: (1) `dev` and `prod` environments exist, (2) branch protection on `develop` and `main` is configured, (3) re-run produces no errors (idempotency). Capture evidence in `evidence/T008/`.
- [x] T009 [US1] Run `setup-github.sh` against all 8 repositories (no `--repo` flag) and verify all have consistent configuration. Capture evidence in `evidence/T009/`.

**Checkpoint**: All 8 GitHub repositories have environments, variables, branch protection configured via script

---

## Phase 4: User Story 2 - Secrets Consolidation in Secret Manager (Priority: P2)

**Goal**: A DevOps engineer runs `setup-secrets.sh` to ensure all application secrets exist in Secret Manager with proper IAM access.

**Independent Test**: Run audit command and verify all 6 secrets exist in Secret Manager with `secretAccessor` role granted to the Cloud Run compute service account.

### Implementation for User Story 2

- [x] T010 [US2] Implement `chat-infra/scripts/setup-secrets.sh` with the following capabilities: (1) source `lib/common.sh` and check prerequisites (gcloud auth, Secret Manager API enabled), (2) load `config/secrets.json` for master list, (3) resolve GCP project ID and project number, (4) for each secret: check existence via `gcloud secrets describe`, create if missing via `gcloud secrets create --replication-policy=automatic`, optionally set value if provided via environment variable (e.g., `SECRET_DB_PASSWORD`) or auto-generate if `auto_generate: true`, (5) grant IAM access: `gcloud secrets add-iam-policy-binding` with `roles/secretmanager.secretAccessor` for `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`, (6) output audit report listing each secret (name, status, version count, IAM bindings). Script MUST accept `--audit-only` flag to report without creating. Secret values MUST never be echoed or logged.
- [x] T011 [US2] Run `setup-secrets.sh` to create the 3 missing secrets (gmail-client-id, gmail-client-secret, gmail-refresh-token) and verify: (1) all 6 secrets exist via `gcloud secrets list`, (2) IAM bindings are correct, (3) re-run with `--audit-only` produces a clean report. Capture evidence in `evidence/T011/`.

**Checkpoint**: All 6 application secrets exist in Secret Manager with correct IAM

---

## Phase 5: User Story 3 - Unified Setup and Verification (Priority: P3)

**Goal**: A DevOps engineer runs `setup-all.sh` for complete infrastructure setup, and `verify.sh` to audit state.

**Independent Test**: Run `setup-all.sh` on a project with partial configuration and verify both Secret Manager and GitHub are fully configured, with a passing verification report.

### Implementation for User Story 3

- [x] T012 [US3] Implement `chat-infra/scripts/verify.sh` with the following checks: (1) source `lib/common.sh`, (2) Secret Manager inventory: for each secret in `config/secrets.json`, check existence and status (active/disabled/destroyed), (3) GitHub environments: for each repo in `config/github-repos.json` with `has_deployments: true`, check environments exist via `gh api`, (4) GitHub variables: for each variable in env config, check current value matches via `gh variable get --env`, (5) Branch protection: for each repo, check `develop` and `main` have protection via `gh api`, (6) output structured pass/fail/warn report per component with counts (e.g., "14/14 passed, 0 failed, 0 warnings"). Exit code 0 if all pass, 1 if any fail.
- [x] T013 [US3] Implement `chat-infra/scripts/setup-all.sh` with the following flow: (1) source `lib/common.sh`, (2) check ALL prerequisites upfront (gcloud + gh + jq + authentication), (3) run `setup-secrets.sh`, (4) run `setup-github.sh`, (5) run `verify.sh`, (6) print summary with counts of secrets created, repos configured, and verification results. Script MUST be idempotent and safe to re-run. If any step fails, report the failure and continue with remaining steps (do not abort on first error).
- [x] T014 [US3] Run `setup-all.sh` end-to-end and verify: (1) secrets are created/verified first, (2) GitHub is configured second, (3) verification report shows all checks passing, (4) re-run produces no changes and all checks still pass. Capture evidence in `evidence/T014/`.

**Checkpoint**: Complete infrastructure setup and verification works end-to-end

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Dual-target copy, documentation, and code quality

- [x] T015 [P] Copy all new scripts and config files from `chat-infra/` to `chat-client/infra/`: `scripts/setup-secrets.sh`, `scripts/setup-github.sh`, `scripts/setup-all.sh`, `scripts/verify.sh`, `scripts/lib/common.sh`, `config/secrets.json`, `config/github-repos.json`, `config/github-envs/dev.json`, `config/github-envs/prod.json`. Ensure file permissions (chmod +x) are preserved.
- [x] T016 [P] Update `chat-infra/README.md` with documentation for new scripts: purpose, usage, prerequisites, config file descriptions, common operations (secret rotation, adding new variables), and troubleshooting guide. Reference `quickstart.md` content.
- [x] T017 [P] Update `chat-client/infra/README.md` with equivalent documentation for the monorepo copy of infrastructure scripts.
- [x] T018 Run ShellCheck on all new scripts (`common.sh`, `setup-secrets.sh`, `setup-github.sh`, `setup-all.sh`, `verify.sh`) in both `chat-infra` and `chat-client/infra/`. Fix any warnings or errors.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (common.sh must exist for script development)
- **US1 (Phase 3)**: Depends on Phase 2 (config files needed); can start independently of US2
- **US2 (Phase 4)**: Depends on Phase 2 (config files needed); can start independently of US1
- **US3 (Phase 5)**: Depends on US1 and US2 completion (orchestrates both scripts)
- **Polish (Phase 6)**: Depends on US1, US2, US3 completion (scripts must be finalized)

### User Story Dependencies

- **US1 (GitHub Infrastructure)**: Can start after Phase 2 — reads secrets from Secret Manager if available, warns if not
- **US2 (Secrets Consolidation)**: Can start after Phase 2 — independent of GitHub configuration
- **US3 (Unified Setup)**: Depends on BOTH US1 and US2 — orchestrates both scripts in sequence

### Within Each User Story

- Implementation tasks before execution/verification tasks
- Each story complete before moving to next priority (unless parallelized)

### Parallel Opportunities

- All Phase 2 config file tasks (T003-T006) can run in parallel
- US1 and US2 can run in parallel after Phase 2 (different scripts, no shared state)
- All Phase 6 tasks (T015-T017) can run in parallel
- T018 (ShellCheck) must run after T015 (needs copies in both repos)

---

## Parallel Example: Foundational Config Files

```bash
# Launch all config file tasks together:
Task: "Create secrets config in chat-infra/config/secrets.json"
Task: "Create repos config in chat-infra/config/github-repos.json"
Task: "Create dev env config in chat-infra/config/github-envs/dev.json"
Task: "Create prod env config in chat-infra/config/github-envs/prod.json"
```

## Parallel Example: US1 + US2 (after Phase 2)

```bash
# These can run in parallel since they're independent scripts:
Task: "Implement setup-github.sh in chat-infra/scripts/setup-github.sh"
Task: "Implement setup-secrets.sh in chat-infra/scripts/setup-secrets.sh"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (common.sh)
2. Complete Phase 2: Foundational (config files)
3. Complete Phase 3: US1 (setup-github.sh)
4. **STOP and VALIDATE**: Run against one repo, verify configuration
5. All GitHub repos are configurable via script

### Incremental Delivery

1. Complete Setup + Foundational: Config-driven infrastructure ready
2. Add US1 (GitHub): Script configures all repos — immediate value
3. Add US2 (Secrets): All secrets consolidated in Secret Manager
4. Add US3 (Unified): Single command for full setup + verification
5. Polish: Dual-target copy + docs

### Cross-Repository Execution Order

1. Implement all scripts in `chat-infra` (canonical source)
2. Run and verify scripts against live infrastructure
3. Copy finalized scripts to `chat-client/infra/`
4. Run ShellCheck on both locations

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story is independently completable and testable
- US1 and US2 can proceed in parallel after Phase 2
- US3 requires both US1 and US2 to be complete
- Commit after each task or logical group
- All scripts live in chat-infra first, copied to chat-client/infra in Phase 6
- Avoid: echoing secret values, hardcoding project IDs, breaking idempotency
