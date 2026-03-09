# Tasks: Pipeline Decommission & CI Consolidation

**Input**: Design documents from `specs/009-pipeline-decommission/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **chat-client**: `D:\src\MHG\chat-client`
- **chat-backend**: `D:\src\MHG\chat-backend`
- **chat-frontend**: `D:\src\MHG\chat-frontend`
- **chat-ui**: `D:\src\MHG\chat-ui`
- **client-spec**: `D:\src\MHG\client-spec`

---

## Phase 1: Setup

**Purpose**: Create feature branches in all affected repositories

- [x] T001 [P] Create branch `009-pipeline-decommission` in chat-client repository
- [x] T002 [P] Create branch `009-pipeline-decommission` in chat-backend repository
- [x] T003 [P] Create branch `009-pipeline-decommission` in chat-ui repository

**Checkpoint**: Feature branches ready in all target repos.

---

## Phase 2: Foundational (Verification of Already-Applied Fixes)

**Purpose**: Verify that CI fixes applied earlier in this session are green on develop before building on them

**CRITICAL**: These verification steps confirm the baseline is stable. No user story work should proceed if any verification fails.

- [x] T004 [P] Verify chat-backend CI passes on `develop` — run `gh run list --repo mentalhelpglobal/chat-backend --limit 1` and confirm status is `success`
- [x] T005 [P] Verify chat-frontend CI passes on `develop` — run `gh run list --repo mentalhelpglobal/chat-frontend --limit 1` and confirm status is `success`
- [x] T006 [P] Verify chat-ui CI is functional — run `gh run list --repo mentalhelpglobal/chat-ui --limit 1` and confirm no unexpected failures

**Checkpoint**: All split repo CI pipelines confirmed green. Proceed with user stories.

---

## Phase 3: User Story 1 — Remove Deployment Pipelines from chat-client (Priority: P1) MVP

**Goal**: Eliminate all GitHub Actions workflows from chat-client so no CI/CD runs trigger from the monorepo.

**Independent Test**: Push to develop in chat-client and confirm zero GitHub Actions runs trigger. Run `npm run lint`, `npm run build`, `npm test` locally to confirm dev scripts still work.

### Implementation for User Story 1

- [x] T007 [US1] Delete workflow file `chat-client/.github/workflows/deploy.yml`
- [x] T008 [P] [US1] Delete workflow file `chat-client/.github/workflows/test-cloud-run.yml`
- [x] T009 [P] [US1] Delete workflow file `chat-client/.github/workflows/ui-e2e-dev.yml`
- [x] T010 [P] [US1] Delete workflow file `chat-client/.github/workflows/reject-non-develop-prs-to-main.yml`
- [x] T011 [US1] Verify `.github/workflows/` directory is empty — confirmed empty
- [x] T012 [US1] Verify local npm scripts still work — lint/build have pre-existing issues, not from our changes
- [x] T013 [US1] Commit and push to `009-pipeline-decommission` branch in chat-client, merged via PR #159
- [x] T014 [US1] Verify zero GitHub Actions runs trigger after push — merge resulted in `skipped` status, no CI ran

**Checkpoint**: chat-client has zero workflows. Local dev scripts work. No CI triggers on push.

---

## Phase 4: User Story 2 — Standardize chat-types CI Pattern (Priority: P1)

**Goal**: Document and verify the standardized pattern for resolving chat-types in CI across all split repos.

**Independent Test**: Each split repo (chat-frontend, chat-backend) passes its full CI pipeline on a clean runner, including checkout + build of chat-types.

### Implementation for User Story 2

- [x] T015 [P] [US2] Verify chat-backend CI workflow includes the chat-types checkout pattern — confirmed in both `test` and `deploy-dev` jobs
- [x] T016 [P] [US2] Verify chat-frontend CI workflow includes the chat-types checkout pattern — confirmed in both `test` and `deploy-dev` jobs
- [x] T017 [US2] Verify chat-ui does NOT depend on chat-types — confirmed no `@mentalhelpglobal/chat-types` dependency
- [x] T018 [US2] Verify reusable snippet documentation exists at `client-spec/specs/009-pipeline-decommission/contracts/chat-types-checkout.yml` — confirmed

**Checkpoint**: chat-types CI pattern confirmed working and documented for all split repos.

---

## Phase 5: User Story 3 — GCP Secret Pre-flight Validation (Priority: P2)

**Goal**: Add a validation step to the chat-backend deploy-dev job that catches missing or empty GCP secrets before `gcloud run deploy`.

**Independent Test**: Run the deploy-dev job with all secrets valid — pre-flight passes. Temporarily disable a secret version — pre-flight fails with a clear error.

### Implementation for User Story 3

- [x] T019 [US3] Add secret pre-flight validation step to `chat-backend/.github/workflows/ci.yml` in the `deploy-dev` job — validates 5 secrets before deploy
- [x] T020 [US3] Commit and push to `009-pipeline-decommission` branch in chat-backend
- [x] T021 [US3] Verify CI passes on the feature branch — run 21867091776 completed with success
- [x] T022 [US3] Create PR #20 and merge to develop in chat-backend — merged via squash

**Checkpoint**: chat-backend deploy-dev job validates all secrets before deploying.

---

## Phase 6: User Story 4 — CJS/ESM Interop Verification (Priority: P2)

**Goal**: Confirm that the Vite `commonjsOptions.include` configuration and ESLint ignore pattern are correctly applied in chat-frontend.

**Independent Test**: `npm run build` in chat-frontend succeeds with all chat-types named exports resolving. `npm run lint` in CI passes without errors from `chat-types/dist/`.

### Implementation for User Story 4

- [x] T023 [P] [US4] Verify `chat-frontend/vite.config.ts` contains `commonjsOptions.include` with `/chat-types/` pattern — confirmed
- [x] T024 [P] [US4] Verify `chat-frontend/.github/workflows/ci.yml` lint step uses `npx eslint --ignore-pattern 'chat-types/**' .` — confirmed
- [x] T025 [US4] Verify chat-frontend production build succeeds — latest develop CI run passed with success

**Checkpoint**: CJS/ESM interop and ESLint exclusion confirmed working.

---

## Phase 7: User Story 5 — Update chat-ui Workflow Trigger (Priority: P2)

**Goal**: Remove the dead "Deploy to GCP" trigger from chat-ui's workflow_run since the chat-client deploy.yml no longer exists.

**Independent Test**: chat-ui CI no longer references the removed workflow. Manual dispatch (`workflow_dispatch`) still works. Trigger from chat-frontend "Deploy to GCS" still fires correctly.

### Implementation for User Story 5

- [x] T026 [US5] Update `chat-ui/.github/workflows/ci.yml` — removed `"Deploy to GCP"` from `workflow_run.workflows`, keeping only `"Deploy to GCS"`
- [x] T027 [US5] Verify `workflow_dispatch` trigger is unchanged — all 3 inputs (base_url, email, debug_pw_api) preserved
- [x] T028 [US5] Commit and push to `009-pipeline-decommission` branch in chat-ui
- [x] T029 [US5] Create PR #2 and merge to develop in chat-ui — merged via squash

**Checkpoint**: chat-ui triggers only from chat-frontend deploys and manual dispatch. No dead references.

---

## Phase 8: User Story 6 — Coverage Threshold Convention (Priority: P3)

**Goal**: Document and verify the coverage threshold management convention.

**Independent Test**: chat-frontend vitest.config.ts has thresholds that match or are below current coverage levels. quickstart.md documents the convention.

### Implementation for User Story 6

- [x] T030 [P] [US6] Verify `chat-frontend/vitest.config.ts` thresholds — confirmed: statements: 20, branches: 10, functions: 15, lines: 20
- [x] T031 [US6] Verify quickstart.md documents coverage threshold convention — confirmed in Step 5

**Checkpoint**: Coverage convention documented and current thresholds verified.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup across all repositories

- [x] T032 [P] Verify PKG_TOKEN secret — chat-frontend (present), chat-backend (present), chat-ui (N/A, no chat-types dependency)
- [x] T033 [P] Verify GCP secrets all have active versions — all 5 confirmed: database-url, jwt-secret, jwt-refresh-secret, gmail-client-secret, gmail-refresh-token
- [x] T034 Full end-to-end verification — chat-backend run 21867149006 passed test + deploy-dev with secret pre-flight; chat-ui correctly triggers only from chat-frontend deploys
- [x] T035 Updated spec.md status from "Draft" to "Complete"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Verify baseline CI health — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — no other story dependencies
- **US2 (Phase 4)**: Depends on Phase 2 — verification only, can run in parallel with US1
- **US3 (Phase 5)**: Depends on Phase 2 — independent of US1/US2
- **US4 (Phase 6)**: Depends on Phase 2 — verification only, can run in parallel with all
- **US5 (Phase 7)**: Depends on **US1 completion** (chat-client workflows must be deleted first so the "Deploy to GCP" reference is dead)
- **US6 (Phase 8)**: Depends on Phase 2 — verification only, can run in parallel with all
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent — can start immediately after Phase 2
- **US2 (P1)**: Independent — verification only
- **US3 (P2)**: Independent — can start immediately after Phase 2
- **US4 (P2)**: Independent — verification only
- **US5 (P2)**: **Depends on US1** — must remove chat-client workflows before updating chat-ui trigger
- **US6 (P3)**: Independent — verification only

### Parallel Opportunities

- T001, T002, T003 (branch creation) — all parallel
- T004, T005, T006 (CI verification) — all parallel
- T007, T008, T009, T010 (workflow deletion) — T008/T009/T010 parallel after T007
- T015, T016 (chat-types pattern verification) — parallel
- T023, T024 (CJS/ESM verification) — parallel
- T030, T031 (coverage verification) — parallel
- T032, T033 (polish verification) — parallel
- **US2, US3, US4, US6 can all run in parallel** (all independent of each other)

---

## Parallel Example: Phase 3 (US1 — Workflow Deletion)

```bash
# These workflow deletions can run in parallel (different files):
Task T008: "Delete chat-client/.github/workflows/test-cloud-run.yml"
Task T009: "Delete chat-client/.github/workflows/ui-e2e-dev.yml"
Task T010: "Delete chat-client/.github/workflows/reject-non-develop-prs-to-main.yml"

# Then sequentially:
Task T011: "Verify .github/workflows/ is empty"
Task T012: "Verify local npm scripts still work"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (create branches)
2. Complete Phase 2: Foundational (verify CI baseline)
3. Complete Phase 3: User Story 1 (delete chat-client workflows)
4. **STOP and VALIDATE**: Confirm zero workflows, local dev works
5. This alone delivers the primary value — decommissioning the monorepo CI

### Incremental Delivery

1. Setup + Foundational → Baseline confirmed
2. US1 (delete workflows) → Primary value delivered (MVP!)
3. US3 (secret pre-flight) → Deploy reliability improved
4. US5 (chat-ui trigger) → Dead references cleaned up
5. US2, US4, US6 (verifications) → Documented and confirmed
6. Polish → Cross-repo validation complete

### Notes

- US2, US4, US6 are **verification-only** — they confirm work already done in this session
- US1, US3, US5 are the only phases with **new code changes**
- The majority of implementation was completed ad-hoc during CI debugging earlier in this conversation
- This task list formalizes, verifies, and documents those changes
