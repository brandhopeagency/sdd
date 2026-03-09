# Tasks: Responsive Touch-Friendly UI and PWA Capability

**Input**: Design documents from `/specs/001-add-responsive-pwa/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Responsive/touch/PWA verification is explicitly required by the spec (`FR-008`), so this task list includes frontend unit and UI/E2E validation tasks.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`)
- Every task includes a concrete file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize shared feature scaffolding for responsive and PWA work.

- [ ] T001 Create feature evidence directory structure in `client-spec/evidence/001-add-responsive-pwa/README.md`
- [ ] T002 Add responsive viewport constants scaffold in `chat-frontend/src/constants/viewports.ts`
- [ ] T003 [P] Add shared responsive utility scaffold in `chat-frontend/src/utils/responsive.ts`
- [ ] T004 [P] Add PWA capability utility scaffold in `chat-frontend/src/utils/pwaSupport.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core building blocks that all user stories depend on.

**⚠️ CRITICAL**: No user story work starts before this phase completes.

- [ ] T005 Define app-wide breakpoint and layout tokens in `chat-frontend/src/styles/breakpoints.css`
- [ ] T006 Define touch target spacing/token baseline in `chat-frontend/src/styles/touch-targets.css`
- [ ] T007 Integrate shared responsive/touch styles in `chat-frontend/src/main.tsx`
- [ ] T008 Configure PWA plugin/build integration in `chat-frontend/vite.config.ts`
- [ ] T009 Create runtime service worker registration module in `chat-frontend/src/pwa/registerServiceWorker.ts`
- [ ] T010 Create installability state hook in `chat-frontend/src/hooks/useInstallabilityStatus.ts`

**Checkpoint**: Foundation complete; user story work can proceed in parallel.

---

## Phase 3: User Story 1 - Use the app on phones and tablets (Priority: P1) 🎯 MVP

**Goal**: Core routes remain readable and fully actionable on phone/tablet viewports.

**Independent Test**: Open core routes in phone/tablet viewport classes and complete primary flows without overflow, hidden controls, or blocked actions.

### Tests for User Story 1

- [ ] T011 [P] [US1] Add responsive layout regression test coverage in `chat-frontend/src/app/App.responsive.test.tsx`
- [ ] T012 [P] [US1] Add mobile/tablet core journey E2E test in `chat-ui/tests/mobile/responsive-core-flows.spec.ts`

### Implementation for User Story 1

- [ ] T013 [US1] Implement responsive shell/navigation behavior in `chat-frontend/src/app/App.tsx`
- [ ] T014 [P] [US1] Implement responsive workbench layout behavior in `chat-frontend/src/features/workbench/layout/WorkbenchLayout.tsx`
- [ ] T015 [P] [US1] Implement responsive chat route layout behavior in `chat-frontend/src/features/chat/pages/ChatPage.tsx`
- [ ] T016 [US1] Add orientation-safe layout handling in `chat-frontend/src/utils/responsive.ts`
- [ ] T017 [US1] Update viewport validation notes and route matrix in `client-spec/specs/001-add-responsive-pwa/quickstart.md`

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Comfortable touch interactions (Priority: P2)

**Goal**: Critical controls are reliably usable via touch-only input.

**Independent Test**: Run touch-only interactions on key pages and confirm critical actions complete without precision-pointer dependency.

### Tests for User Story 2

- [ ] T018 [P] [US2] Add touch interaction unit coverage for critical controls in `chat-frontend/src/components/__tests__/touch-targets.test.tsx`
- [ ] T019 [P] [US2] Add touch-only E2E flow validation in `chat-ui/tests/mobile/touch-comfort-core.spec.ts`

### Implementation for User Story 2

- [ ] T020 [US2] Apply touch-friendly target sizing to shared controls in `chat-frontend/src/components/ui/Button.tsx`
- [ ] T021 [P] [US2] Apply touch-friendly target sizing to form actions in `chat-frontend/src/components/ui/IconButton.tsx`
- [ ] T022 [P] [US2] Apply touch spacing and interaction updates in `chat-frontend/src/styles/touch-targets.css`
- [ ] T023 [US2] Ensure touch-only navigation fallback behavior in `chat-frontend/src/app/App.tsx`

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Install app as PWA (Priority: P3)

**Goal**: App is installable on supported platforms and graceful in-browser fallback exists when install is unsupported.

**Independent Test**: Validate install path and post-install start behavior on supported browsers; validate fallback behavior on unsupported paths.

### Tests for User Story 3

- [ ] T024 [P] [US3] Add PWA installability E2E coverage in `chat-ui/tests/pwa/installability.spec.ts`
- [ ] T025 [P] [US3] Add unsupported-platform fallback E2E coverage in `chat-ui/tests/pwa/fallback.spec.ts`

### Implementation for User Story 3

- [ ] T026 [US3] Implement production manifest metadata and icons wiring in `chat-frontend/public/manifest.webmanifest`
- [ ] T027 [US3] Implement service worker lifecycle handling in `chat-frontend/src/pwa/registerServiceWorker.ts`
- [ ] T028 [US3] Implement install prompt/fallback UX state handling in `chat-frontend/src/hooks/useInstallabilityStatus.ts`
- [ ] T029 [US3] Wire installability UX entry points in `chat-frontend/src/app/App.tsx`

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Release hardening, evidence, and governance completion tasks.

- [ ] T030 [P] Capture responsive/touch/PWA validation evidence index in `client-spec/evidence/001-add-responsive-pwa/validation-summary.md`
- [ ] T031 [P] Align validation contract with final checks in `client-spec/specs/001-add-responsive-pwa/contracts/responsive-pwa-validation.yaml`
- [ ] T032 Add post-deploy smoke checklist for critical routes/deep links/APIs in `client-spec/specs/001-add-responsive-pwa/quickstart.md`
- [ ] T033 Add CI job wiring for responsive/PWA regression gate in `chat-ci/.github/workflows/ui-regression.yml`
- [ ] T034 Open PR checklist notes for split repos in `client-spec/specs/001-add-responsive-pwa/plan.md`
- [ ] T035 Execute branch hygiene record (remote/local deletion + develop sync) in `client-spec/evidence/001-add-responsive-pwa/branch-hygiene.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately.
- **Phase 2 (Foundational)**: depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: depends on Phase 2; MVP-first target.
- **Phase 4 (US2)**: depends on Phase 2; can run parallel with US1 once foundations are stable.
- **Phase 5 (US3)**: depends on Phase 2; can run parallel with US1/US2.
- **Phase 6 (Polish)**: depends on completion of the selected user stories.

### User Story Dependencies

- **US1 (P1)**: no dependency on other stories after foundational tasks.
- **US2 (P2)**: can be independent, but reuses layout primitives from US1-related files.
- **US3 (P3)**: independent of US1/US2 business logic; shares app shell integration points.

### Within Each User Story

- Tests first where feasible, then implementation.
- Shared utility/style updates before route-specific integration.
- Story checkpoint must pass before marking story complete.

### Parallel Opportunities

- Setup tasks `T003`-`T004`.
- Foundational tasks `T005`-`T006`, and `T008`-`T010` after scaffolds exist.
- US1 tests `T011`-`T012` and implementation tasks `T014`-`T015`.
- US2 tests `T018`-`T019` and implementation tasks `T021`-`T022`.
- US3 tests `T024`-`T025`.
- Polish tasks `T030`-`T031`.

---

## Parallel Example: User Story 1

```bash
Task: "Add responsive layout regression test coverage in chat-frontend/src/app/App.responsive.test.tsx"
Task: "Add mobile/tablet core journey E2E test in chat-ui/tests/mobile/responsive-core-flows.spec.ts"

Task: "Implement responsive workbench layout behavior in chat-frontend/src/features/workbench/layout/WorkbenchLayout.tsx"
Task: "Implement responsive chat route layout behavior in chat-frontend/src/features/chat/pages/ChatPage.tsx"
```

---

## Parallel Example: User Story 3

```bash
Task: "Add PWA installability E2E coverage in chat-ui/tests/pwa/installability.spec.ts"
Task: "Add unsupported-platform fallback E2E coverage in chat-ui/tests/pwa/fallback.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phases 1-2.
2. Complete Phase 3 (US1).
3. Validate US1 independently on phone/tablet.
4. Demo/release MVP increment.

### Incremental Delivery

1. Foundation (Phases 1-2).
2. US1 (responsive core).
3. US2 (touch comfort hardening).
4. US3 (PWA installability and fallback).
5. Polish + release evidence.

### Parallel Team Strategy

1. Team completes Setup + Foundational phases together.
2. Then split by story:
   - Dev A: US1
   - Dev B: US2
   - Dev C: US3
3. Converge for Phase 6 evidence and PR/release hygiene.

---

## Notes

- All tasks follow strict checklist format with IDs and paths.
- Story labels are used only in user story phases.
- Keep PR-only integration into `develop` for all affected split repositories.
- Preserve constitution-required responsive/PWA and smoke-check evidence before release promotion.
