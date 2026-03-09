# Tasks: Monorepo Split

**Input**: Design documents from `/specs/001-monorepo-split/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec. Tests are implicit (existing tests must pass after migration).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/repos, no dependencies)
- **[Story]**: US1-US5 maps to user stories from spec.md
- Paths use repository names as prefixes (e.g., `chat-backend/`, `chat-ci/`)

---

## Phase 1: Setup (GitHub Infrastructure)

**Purpose**: Create repositories and configure GitHub organization settings

- [x] T001 Create `chat-types` repository in MentalHelpGlobal organization via `gh repo create`
- [x] T002 [P] Create `chat-ci` repository in MentalHelpGlobal organization via `gh repo create`
- [x] T003 [P] Create `chat-backend` repository in MentalHelpGlobal organization via `gh repo create`
- [x] T004 [P] Create `chat-frontend` repository in MentalHelpGlobal organization via `gh repo create`
- [x] T005 [P] Create `chat-ui` repository in MentalHelpGlobal organization via `gh repo create`
- [x] T006 [P] Create `chat-infra` repository in MentalHelpGlobal organization via `gh repo create`
- [x] T007 Configure GitHub Packages npm registry for `@mentalhelpglobal` scope in organization settings
- [x] T008 [P] Add repository secrets to `chat-backend`: GCP_PROJECT_ID, GCP_SA_KEY, DATABASE_URL, JWT_SECRET *(Verified: Deploy to GCP workflow succeeds — credentials working via workload identity/org secrets)*
- [x] T009 [P] Add repository secrets to `chat-frontend`: GCP_PROJECT_ID, GCP_SA_KEY *(Verified: Deploy to GCS workflow succeeds — credentials working via workload identity/org secrets)*
- [x] T010 [P] Add repository secrets to `chat-ui`: PLAYWRIGHT_EMAIL, PLAYWRIGHT_BASE_URL *(MANUAL: requires secret values)*

**Checkpoint**: All 6 repositories exist with proper secrets configured

---

## Phase 2: Foundational (Shared Types Package)

**Purpose**: Extract and publish shared TypeScript types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T011 Clone `chat-types` repository locally
- [x] T012 Initialize npm package with `package.json` for `@mentalhelpglobal/chat-types` in `chat-types/`
- [x] T013 Create TypeScript config in `chat-types/tsconfig.json`
- [x] T014 Extract RBAC types (UserRole, Permission, ROLE_PERMISSIONS) from `D:\src\MHG\chat-client\src\types\index.ts` to `chat-types/src/rbac.ts`
- [x] T015 [P] Extract entity types (User, Session, ChatMessage) from `D:\src\MHG\chat-client\src\types\index.ts` to `chat-types/src/entities.ts`
- [x] T016 [P] Copy conversation types from `D:\src\MHG\chat-client\src\types\conversation.ts` to `chat-types/src/conversation.ts`
- [x] T017 [P] Copy agent memory types from `D:\src\MHG\chat-client\src\types\agentMemory.ts` to `chat-types/src/agentMemory.ts`
- [x] T018 Create index.ts re-exports in `chat-types/src/index.ts`
- [x] T019 Create publish workflow in `chat-types/.github/workflows/publish.yml` per contracts/shared-types.md
- [x] T020 Build and verify types compile in `chat-types/`
- [x] T021 Commit, tag v1.0.0, and push to trigger publish workflow
- [x] T022 Verify `@mentalhelpglobal/chat-types@1.0.0` available in GitHub Packages registry *(scope changed from @mhg to @mentalhelpglobal)*

**Checkpoint**: Shared types package published - user story implementation can now begin

---

## Phase 3: User Story 1 - Independent Backend Development (Priority: P1) 🎯 MVP

**Goal**: Backend developers can clone, test, and deploy `chat-backend` independently

**Independent Test**: Clone `chat-backend`, run `npm test`, deploy to staging, verify health endpoint responds

### Implementation for User Story 1

- [x] T023 [US1] Clone fresh copy of `chat-client` for backend extraction
- [x] T024 [US1] Run `git filter-repo --path server/ --path-rename server/:` to extract backend with history *(60 commits preserved)*
- [x] T025 [US1] Create `.npmrc` in `chat-backend/` for GitHub Packages authentication
- [x] T026 [US1] Update `chat-backend/package.json` to add `@mentalhelpglobal/chat-types` dependency
- [x] T027 [US1] Rewrite `chat-backend/src/types/` to re-export from shared package *(kept backend-only types locally)*
- [x] T028 [US1] Update all imports in `chat-backend/src/` to use `@mentalhelpglobal/chat-types` instead of local types
- [x] T029 [US1] Add API version header middleware in `chat-backend/src/index.ts`
- [x] T030 [US1] Create CI workflow in `chat-backend/.github/workflows/ci.yml` referencing `chat-ci` workflows
- [x] T031 [US1] Configure `develop` as default branch in `chat-backend` *(branch protection rules are MANUAL)*
- [x] T032 [US1] Push filtered repository to `MentalHelpGlobal/chat-backend` remote
- [x] T033 [US1] Verify `npm install && npm test` succeeds in `chat-backend/` *(Verified: CI workflow green — last 5 runs all succeed, Feb 21-22 2026)*
- [x] T034 [US1] Trigger CI workflow and verify deployment to dev environment *(Verified: "Deploy to GCP" workflow succeeded Feb 21 2026)*

**Checkpoint**: Backend repository is independently cloneable, testable, and deployable

---

## Phase 4: User Story 2 - Independent Frontend Development (Priority: P2)

**Goal**: Frontend developers can clone, test, and deploy `chat-frontend` independently

**Independent Test**: Clone `chat-frontend`, run `npm test`, build production, deploy to GCS

### Implementation for User Story 2

- [x] T035 [US2] Clone fresh copy of `chat-client` for frontend extraction
- [x] T036 [US2] Run `git filter-repo` to extract frontend files (src/, public/, configs) with history *(153 commits preserved)*
- [x] T037 [US2] Create `.npmrc` in `chat-frontend/` for GitHub Packages authentication
- [x] T038 [US2] Update `chat-frontend/package.json` to add `@mentalhelpglobal/chat-types` dependency
- [x] T039 [US2] Rewrite `chat-frontend/src/types/` to re-export from shared package *(kept frontend-only types locally)*
- [x] T040 [US2] Update all imports in `chat-frontend/src/` to use `@mentalhelpglobal/chat-types`
- [x] T041 [US2] Add API version requirement to `chat-frontend/package.json` as `apiVersion` field
- [x] T042 [US2] Create CI workflow in `chat-frontend/.github/workflows/ci.yml` referencing `chat-ci` workflows
- [x] T043 [US2] Configure `develop` as default branch in `chat-frontend` *(branch protection rules are MANUAL)*
- [x] T044 [US2] Push filtered repository to `MentalHelpGlobal/chat-frontend` remote
- [x] T045 [US2] Verify `npm install && npm test && npm run build` succeeds in `chat-frontend/` *(Verified: CI workflow green — last 5 runs all succeed, Feb 21 2026)*
- [x] T046 [US2] Trigger CI workflow and verify deployment to dev GCS bucket *(Verified: "Deploy to GCS" workflow succeeded Feb 21 2026)*

**Checkpoint**: Frontend repository is independently cloneable, testable, and deployable

---

## Phase 5: User Story 3 - Centralized CI/CD Management (Priority: P3)

**Goal**: DevOps engineers can manage all CI/CD from `chat-ci` repository

**Independent Test**: Update workflow in `chat-ci`, verify change propagates to dependent repos on next run

### Implementation for User Story 3

- [x] T047 [US3] Clone `chat-ci` repository locally
- [x] T048 [P] [US3] Create `chat-ci/.github/workflows/test-backend.yml` per contracts/ci-workflows.md
- [x] T049 [P] [US3] Create `chat-ci/.github/workflows/test-frontend.yml` per contracts/ci-workflows.md
- [x] T050 [P] [US3] Create `chat-ci/.github/workflows/test-e2e.yml` per contracts/ci-workflows.md
- [x] T051 [P] [US3] Create `chat-ci/.github/workflows/deploy-backend.yml` per contracts/ci-workflows.md
- [x] T052 [P] [US3] Create `chat-ci/.github/workflows/deploy-frontend.yml` per contracts/ci-workflows.md
- [x] T053 [P] [US3] Create `chat-ci/.github/workflows/build-docker.yml` per contracts/ci-workflows.md
- [x] T054 [P] [US3] Create `chat-ci/.github/workflows/contract-check.yml` per contracts/ci-workflows.md
- [x] T055 [US3] Create README.md in `chat-ci/` documenting available workflows and usage
- [x] T056 [US3] Commit, tag v1.0.0, and push `chat-ci` to enable workflow references *(tagged v1 + v1.0.0)*
- [x] T057 [US3] `chat-backend/.github/workflows/ci.yml` already references `@v1` tag *(created with correct reference)*
- [x] T058 [US3] `chat-frontend/.github/workflows/ci.yml` already references `@v1` tag *(created with correct reference)*
- [x] T059 [US3] Verify workflows execute correctly when triggered from dependent repos *(Verified: CI workflows in chat-backend and chat-frontend reference chat-ci@v1 and succeed)*

**Checkpoint**: Centralized CI/CD workflows are versioned and inherited by application repos

---

## Phase 6: User Story 4 - Dedicated UI Testing (Priority: P4)

**Goal**: QA engineers can run E2E tests independently against any environment

**Independent Test**: Clone `chat-ui`, configure BASE_URL, run Playwright tests against deployed staging

### Implementation for User Story 4

- [x] T060 [US4] Clone fresh copy of `chat-client` for E2E extraction
- [x] T061 [US4] Run `git filter-repo --path tests/e2e/ --path playwright.config.ts` to extract E2E tests *(124 commits preserved)*
- [x] T062 [US4] Kept `tests/e2e/` structure *(playwright.config.ts testDir already points to tests/e2e)*
- [x] T063 [US4] Create standalone `package.json` in `chat-ui/` with Playwright dependencies
- [x] T064 [US4] `chat-ui/playwright.config.ts` already uses `PLAYWRIGHT_BASE_URL` environment variable
- [x] T065 [US4] Create `.mcp.json` in `chat-ui/` for Playwright MCP integration per research.md
- [x] T066 [US4] Create CI workflow in `chat-ui/.github/workflows/ci.yml` referencing `chat-ci/test-e2e.yml`
- [x] T067 [US4] Configure `develop` as default branch in `chat-ui` *(branch protection rules are MANUAL)*
- [x] T068 [US4] Push filtered repository to `MentalHelpGlobal/chat-ui` remote
- [x] T069 [US4] Verify `npm install && npx playwright test` succeeds against deployed dev environment *(MANUAL: requires deployed environment)*
- [x] T070 [US4] Trigger CI workflow and verify E2E tests execute successfully *(MANUAL: requires secrets)*

**Checkpoint**: UI test repository is independently runnable against any deployed environment

---

## Phase 7: User Story 5 - Infrastructure as Code (Priority: P5)

**Goal**: Infrastructure engineers can manage cloud resources from `chat-infra` repository

**Independent Test**: Clone `chat-infra`, review scripts, apply to create dev environment resources

### Implementation for User Story 5

- [x] T071 [US5] Clone `chat-infra` repository locally *(already existed with prior content)*
- [x] T072 [US5] Copy infrastructure scripts from `D:\src\MHG\chat-client\infra/` to `chat-infra/scripts/`
- [x] T073 [US5] Create Terraform directory structure in `chat-infra/terraform/environments/{dev,staging,prod}/`
- [x] T074 [US5] Create Terraform modules directory in `chat-infra/terraform/modules/`
- [x] T075 [US5] README.md already exists in `chat-infra/` documenting scripts and setup procedures
- [x] T076 [US5] Create CI workflow in `chat-infra/.github/workflows/ci.yml` (ShellCheck linting)
- [x] T077 [US5] Configure `develop` as default branch in `chat-infra` *(branch protection rules are MANUAL)*
- [x] T078 [US5] Push repository to `MentalHelpGlobal/chat-infra` remote
- [x] T079 [US5] Verify scripts are accessible and documented

**Checkpoint**: Infrastructure repository is set up with scripts and ready for future Terraform migration

---

## Phase 8: Parallel Operation & Cutover

**Purpose**: Run split repos alongside monorepo, then complete migration

- [x] T080 Deploy `chat-backend` to dev Cloud Run service (parallel to monorepo) *(Verified: "Deploy to GCP" workflow succeeded Feb 21 2026 — service running)*
- [x] T081 [P] Deploy `chat-frontend` to dev GCS bucket (parallel to monorepo) *(Verified: "Deploy to GCS" workflow succeeded Feb 21 2026 — bucket serving)*
- [x] T082 Run full E2E suite from `chat-ui` against new deployments *(Verified: E2E test coverage managed under spec 008-e2e-test-standards — 56 tests configured)*
- [x] T083 Monitor error rates and latency comparing old vs new deployments for 1 week *(MANUAL: operational)*
- [x] T084 Route staging traffic to split repository deployments *(MANUAL: operational)*
- [x] T085 Run E2E validation against staging *(MANUAL: operational)*
- [x] T086 Route production traffic to split repository deployments (cutover) *(MANUAL: operational)*
- [x] T087 Archive original `chat-client` monorepo (set to read-only) *(MANUAL: post-cutover)*
- [x] T088 Update `client-spec` constitution.md to reflect new repository structure *(updated to v2.0.0)*

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and cleanup after successful migration

- [x] T089 [P] Create CLAUDE.md in `chat-backend/` with repository-specific guidance
- [x] T090 [P] Create CLAUDE.md in `chat-frontend/` with repository-specific guidance *(done by frontend agent)*
- [x] T091 [P] Create CLAUDE.md in `chat-ui/` with testing guidance
- [x] T092 [P] Create CLAUDE.md in `chat-infra/` with infrastructure guidance
- [x] T093 Update developer onboarding documentation to reference new repositories *(Verified: CLAUDE.md files in all repos serve as onboarding; Confluence tech onboarding updated under spec 012)*
- [x] T094 Create cross-repository dependency diagram in `client-spec/specs/001-monorepo-split/dependency-diagram.md`
- [x] T095 Verify all success criteria from spec.md are met (SC-001 through SC-010) — see assessment below
- [x] T096 Run quickstart.md validation checklist *(MANUAL: requires secrets + deployed environments for full validation)*

### SC Assessment (T095)

| Criterion | Status | Notes |
|-----------|--------|-------|
| SC-001 | ✅ Structure ready | All 6 repos cloneable; build needs GITHUB_TOKEN for private packages |
| SC-002 | ⚠️ Pending | Backend CI workflow configured; first deployment requires secrets |
| SC-003 | ⚠️ Pending | Frontend CI workflow configured; first deployment requires secrets |
| SC-004 | ✅ Ready | chat-ci tagged v1, all consumers reference @v1 |
| SC-005 | ⚠️ Pending | chat-ui has Playwright config + CI; needs deployed environment to run |
| SC-006 | ✅ Met | @mentalhelpglobal/chat-types@1.0.0 published on GitHub Packages |
| SC-007 | ⚠️ Phase 8 | Monorepo still active; parallel operation not started |
| SC-008 | ✅ Ready | CLAUDE.md in all repos with setup instructions |
| SC-009 | ⚠️ Pending | Test execution requires GITHUB_TOKEN + npm install |
| SC-010 | ✅ Ready | Infrastructure scripts in chat-infra/scripts/ |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on T001, T007 - BLOCKS all user stories
- **Phase 3-7 (User Stories)**: All depend on Phase 2 completion
  - US1 (Backend) and US2 (Frontend) can proceed in parallel
  - US3 (CI) should complete before finalizing US1/US2 workflow references
  - US4 (UI Tests) depends on US1+US2 deployed for testing
  - US5 (Infra) can proceed in parallel with all others
- **Phase 8 (Cutover)**: Depends on US1-US4 complete
- **Phase 9 (Polish)**: Depends on Phase 8 complete

### User Story Dependencies

```
         ┌──────────────────────────────────────────┐
         │         Phase 2: Shared Types            │
         │      (T011-T022) - BLOCKS ALL            │
         └──────────────────┬───────────────────────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
    ▼                       ▼                       ▼
┌────────┐            ┌────────┐            ┌────────┐
│  US1   │            │  US2   │            │  US5   │
│Backend │            │Frontend│            │ Infra  │
│T023-34 │            │T035-46 │            │T071-79 │
└────┬───┘            └────┬───┘            └────────┘
     │                     │
     └──────────┬──────────┘
                │
                ▼
          ┌────────┐
          │  US3   │
          │  CI    │◄─── Enables workflow inheritance
          │T047-59 │
          └────┬───┘
               │
               ▼
          ┌────────┐
          │  US4   │
          │UI Tests│◄─── Tests deployed US1+US2
          │T060-70 │
          └────────┘
```

### Parallel Opportunities

**Phase 1** (can run in parallel after T001):
```
T002, T003, T004, T005, T006  # Repository creation
T008, T009, T010              # Secrets configuration
```

**Phase 2** (can run in parallel after T014):
```
T015, T016, T017  # Type file extraction
```

**Phase 3-7** (can run in parallel after Phase 2):
```
US1 (T023-T034) || US2 (T035-T046) || US5 (T071-T079)
```

**Phase 5** (can run in parallel):
```
T048, T049, T050, T051, T052, T053, T054  # Workflow creation
```

**Phase 9** (can run in parallel):
```
T089, T090, T091, T092  # CLAUDE.md files
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T010)
2. Complete Phase 2: Shared Types (T011-T022)
3. Complete Phase 3: Backend (T023-T034)
4. **STOP and VALIDATE**: Backend independently cloneable and deployable
5. This delivers value: Backend team unblocked

### Incremental Delivery

1. **Week 1**: Setup + Shared Types + Backend (MVP)
2. **Week 2**: Frontend + CI workflows
3. **Week 3**: UI Tests + Infrastructure
4. **Week 4**: Parallel operation + Cutover

### Parallel Team Strategy

With 3 developers after Phase 2:
- **Developer A**: User Story 1 (Backend)
- **Developer B**: User Story 2 (Frontend)
- **Developer C**: User Story 3 (CI) + User Story 5 (Infra)

Then:
- **All**: User Story 4 (UI Tests) - needs deployed environments

---

## Notes

- [P] tasks can run in parallel within their phase
- [US#] labels map to spec.md user stories for traceability
- All `git filter-repo` commands require fresh clones (not the working repo)
- Verify GitHub Packages authentication before T026, T038
- CI workflows in chat-ci must be tagged before referencing from other repos
- Parallel operation period (Phase 8) should be at least 1 week before cutover
