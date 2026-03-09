# Implementation Plan: Pipeline Decommission & CI Consolidation

**Branch**: `009-pipeline-decommission` | **Date**: 2026-02-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/009-pipeline-decommission/spec.md`

## Summary

Decommission all GitHub Actions workflows from the chat-client monorepo (4 files) and consolidate CI/CD patterns across the split repositories (chat-frontend, chat-backend, chat-ui). This includes standardizing chat-types dependency resolution, GCP secret pre-flight validation, CJS/ESM interop configuration, and coverage threshold management. Much of the technical work was already completed ad-hoc during CI debugging; this plan formalizes, documents, and verifies the patterns.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20  
**Primary Dependencies**: GitHub Actions, Google Cloud SDK (gcloud), Vite 5.x, Vitest, Playwright  
**Storage**: GCP Secret Manager (secrets), GCS (frontend assets), Cloud Run (backend containers)  
**Testing**: Vitest (unit), Playwright (E2E), GitHub Actions CI  
**Target Platform**: GitHub Actions runners (ubuntu-latest), GCP europe-west1  
**Project Type**: Multi-repository CI/CD infrastructure  
**Performance Goals**: CI pipelines complete within 5 minutes  
**Constraints**: No manual GCP Console changes (gcloud CLI only); PKG_TOKEN must have `repo` + `read:packages` scopes  
**Scale/Scope**: 4 repositories affected (chat-client, chat-frontend, chat-backend, chat-ui)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-First Development | PASS | Spec completed with clarifications resolved |
| II. Multi-Repository Orchestration | PASS | All 4 target repos explicitly referenced |
| III. Test-Aligned Development | PASS | Split repos retain their CI test infrastructure |
| IV. Branch and Integration Discipline | PASS | Feature branches in all affected repos, merge to develop |
| V. Privacy and Security First | N/A | No user data changes |
| VI. Accessibility and i18n | N/A | No user-facing changes |
| VII. Dual-Target Discipline | **JUSTIFIED** | Removing CI from chat-client is deliberate — split repos are canonical for CI (per VII: "split repos are the canonical source for CI"). See Complexity Tracking. |
| VIII. GCP CLI Infrastructure | PASS | All secret provisioning via gcloud CLI commands |

## Project Structure

### Documentation (this feature)

```text
specs/009-pipeline-decommission/
├── plan.md              # This file
├── research.md          # Phase 0 output (7 decisions)
├── quickstart.md        # Phase 1: CI setup guide for new repos
├── contracts/           # Phase 1: Standardized CI workflow patterns
│   ├── chat-types-checkout.yml   # Reusable checkout+build snippet
│   └── secret-preflight.sh       # GCP secret validation script
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository changes)

```text
chat-client/.github/workflows/     # DELETE all 4 files
  deploy.yml                        # → replaced by chat-frontend + chat-backend CI
  test-cloud-run.yml                # → replaced by split repo test jobs
  ui-e2e-dev.yml                    # → replaced by chat-ui CI
  reject-non-develop-prs-to-main.yml # → no longer needed

chat-backend/.github/workflows/
  ci.yml                            # ADD: secret pre-flight step in deploy-dev job

chat-frontend/.github/workflows/
  ci.yml                            # VERIFY: chat-types checkout pattern (already applied)

chat-ui/.github/workflows/
  ci.yml                            # UPDATE: remove dead "Deploy to GCP" trigger
```

**Structure Decision**: This is a CI/CD infrastructure feature. Changes are workflow YAML files and configuration — no application source code changes.

## Implementation Phases

### Phase 1: Remove chat-client Workflows (US1) — P1

**Target**: `chat-client` repository

| Step | Action | File |
|------|--------|------|
| 1a | Delete `deploy.yml` | `chat-client/.github/workflows/deploy.yml` |
| 1b | Delete `test-cloud-run.yml` | `chat-client/.github/workflows/test-cloud-run.yml` |
| 1c | Delete `ui-e2e-dev.yml` | `chat-client/.github/workflows/ui-e2e-dev.yml` |
| 1d | Delete `reject-non-develop-prs-to-main.yml` | `chat-client/.github/workflows/reject-non-develop-prs-to-main.yml` |
| 1e | Verify `.github/workflows/` is empty or absent | `chat-client/.github/workflows/` |
| 1f | Verify local npm scripts still work | `npm run lint`, `npm run build`, `npm test` in chat-client |

**Verification**: Push to develop → confirm zero GitHub Actions run.

### Phase 2: Verify & Standardize chat-types CI Pattern (US2) — P1

**Status**: Already implemented in chat-backend (`2d9ce9d`) and chat-frontend (PR #9).

| Step | Action | Target |
|------|--------|--------|
| 2a | Verify chat-backend CI passes on develop | `chat-backend` (already green) |
| 2b | Verify chat-frontend CI passes on develop | `chat-frontend` (already green) |
| 2c | Verify chat-ui does NOT need chat-types | `chat-ui/package.json` (confirmed: no dependency) |
| 2d | Create reusable snippet documentation | `specs/009-pipeline-decommission/contracts/chat-types-checkout.yml` |

### Phase 3: Add GCP Secret Pre-flight Validation (US3) — P2

**Target**: `chat-backend` repository

| Step | Action | File |
|------|--------|------|
| 3a | Create validation script | `specs/009-pipeline-decommission/contracts/secret-preflight.sh` |
| 3b | Add pre-flight step to chat-backend deploy-dev job | `chat-backend/.github/workflows/ci.yml` |
| 3c | Verify: run deploy with valid secrets → passes pre-flight | CI run on develop |
| 3d | Document gcloud commands used for secret provisioning | `research.md` (already captured) |

**gcloud commands** (already executed this session):
```bash
# Add placeholder values to empty secrets
echo "placeholder-not-configured" | gcloud secrets versions add gmail-client-secret \
  --data-file=- --project=mental-help-global-25

echo "placeholder-not-configured" | gcloud secrets versions add gmail-refresh-token \
  --data-file=- --project=mental-help-global-25

# Grant Cloud Run SA access
gcloud secrets add-iam-policy-binding gmail-client-secret \
  --project=mental-help-global-25 \
  --member="serviceAccount:942889188964-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding gmail-refresh-token \
  --project=mental-help-global-25 \
  --member="serviceAccount:942889188964-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Phase 4: Verify CJS/ESM Interop & ESLint Config (US4) — P2

**Status**: Already implemented in chat-frontend (commits `452c9e1` and `42e79f3`).

| Step | Action | Target |
|------|--------|--------|
| 4a | Verify `commonjsOptions.include` in chat-frontend vite.config.ts | `chat-frontend/vite.config.ts` |
| 4b | Verify ESLint ignore pattern in CI | `chat-frontend/.github/workflows/ci.yml` |
| 4c | Verify production build succeeds | chat-frontend CI on develop (already green) |

### Phase 5: Update chat-ui Workflow Trigger (US2 related) — P2

**Target**: `chat-ui` repository

| Step | Action | File |
|------|--------|------|
| 5a | Remove dead "Deploy to GCP" from `workflow_run.workflows` list | `chat-ui/.github/workflows/ci.yml` |
| 5b | Verify "Deploy to GCS" trigger (chat-frontend deploy name) is correct | Match workflow name |
| 5c | Verify manual dispatch still works | `workflow_dispatch` path unchanged |

### Phase 6: Coverage Threshold Convention (US5) — P3

**Target**: Documentation only (convention, not code)

| Step | Action | Target |
|------|--------|--------|
| 6a | Verify current chat-frontend thresholds reflect post-review-feature baseline | `chat-frontend/vitest.config.ts` (already adjusted) |
| 6b | Document convention in quickstart.md | `specs/009-pipeline-decommission/quickstart.md` |

### Phase 7: Documentation & Quickstart (All US)

| Step | Action | Target |
|------|--------|--------|
| 7a | Write quickstart.md (CI setup guide for new repos) | `specs/009-pipeline-decommission/quickstart.md` |
| 7b | Write chat-types-checkout.yml reusable snippet | `specs/009-pipeline-decommission/contracts/chat-types-checkout.yml` |
| 7c | Write secret-preflight.sh script | `specs/009-pipeline-decommission/contracts/secret-preflight.sh` |

## Cross-Repository Dependencies

| Source | Target | Dependency |
|--------|--------|------------|
| chat-client workflow removal | chat-ui trigger update | Must remove "Deploy to GCP" trigger reference after chat-client workflows are deleted |
| chat-types (default branch) | chat-frontend, chat-backend CI | All split repo CI jobs depend on chat-types being buildable |
| GCP Secret Manager | chat-backend deploy-dev | Secrets must have valid versions before deploy |
| PKG_TOKEN secret | All split repos | Token must have `repo` + `read:packages` scopes in every repo |

## Execution Order

1. **Phase 7** (documentation) — can be done first since it's spec artifacts only
2. **Phase 1** (remove chat-client workflows) — independent, no downstream dependencies
3. **Phase 5** (update chat-ui trigger) — should happen after Phase 1 to avoid referencing dead workflows
4. **Phase 3** (secret pre-flight) — independent of other phases
5. **Phases 2, 4, 6** — verification only; already implemented

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| VII. Dual-Target: Removing CI from chat-client while split repos retain CI | Split repos are the canonical deployment source (per VII itself: "split repos are the canonical source for CI"). Keeping duplicate CI wastes GHA minutes and risks conflicting deploys. | Keeping CI in both wastes resources and creates deployment conflicts. |
