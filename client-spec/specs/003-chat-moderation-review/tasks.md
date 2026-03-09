# Tasks: Chat Moderation and Review System

**Input**: Design documents from `/specs/003-chat-moderation-review/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Test execution is defined in `quickstart.md`; explicit test-implementation tasks are not required by this specification.  
**Organization**: Tasks are grouped by user story to enable independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Each task includes a concrete file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare split repositories and shared contracts for implementation.

- [X] T001 Create feature branch `003-chat-moderation-review` in `D:/src/MHG/chat-types`, `D:/src/MHG/chat-backend`, `D:/src/MHG/chat-frontend`, and `D:/src/MHG/chat-ui`
- [X] T002 [P] Align review domain type definitions in `D:/src/MHG/chat-types/src/review.ts`
- [X] T003 [P] Align review configuration types in `D:/src/MHG/chat-types/src/reviewConfig.ts`
- [X] T004 [P] Align review RBAC permissions in `D:/src/MHG/chat-types/src/rbac.ts`
- [X] T005 Publish and consume updated shared package from `D:/src/MHG/chat-types/package.json` in `D:/src/MHG/chat-backend/package.json` and `D:/src/MHG/chat-frontend/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build core backend/frontend foundations that all user stories depend on.

**⚠️ CRITICAL**: Complete this phase before starting user-story phases.

- [X] T006 Create review schema migration scaffolding in `D:/src/MHG/chat-backend/src/db/migrations/`
- [X] T007 Implement `ChatSession`, `SessionReview`, and `MessageRating` persistence mappings in `D:/src/MHG/chat-backend/src/services/reviewQueue.service.ts`
- [X] T008 [P] Implement `RiskFlag` and escalation persistence mappings in `D:/src/MHG/chat-backend/src/services/riskFlag.service.ts`
- [X] T009 [P] Implement `DeanonymizationRequest` persistence mappings in `D:/src/MHG/chat-backend/src/services/deanonymization.service.ts`
- [X] T010 [P] Implement immutable audit-event write utility in `D:/src/MHG/chat-backend/src/services/audit.service.ts`
- [X] T011 Wire review route mounts in `D:/src/MHG/chat-backend/src/index.ts`
- [X] T012 Implement backend RBAC middleware checks for review queue/session routes in `D:/src/MHG/chat-backend/src/routes/review.queue.ts` and `D:/src/MHG/chat-backend/src/routes/review.sessions.ts`
- [X] T013 [P] Implement backend RBAC middleware checks for risk and escalation routes in `D:/src/MHG/chat-backend/src/routes/review.flags.ts`
- [X] T014 [P] Implement backend RBAC middleware checks for deanonymization and admin routes in `D:/src/MHG/chat-backend/src/routes/review.deanonymization.ts` and `D:/src/MHG/chat-backend/src/routes/admin.reviewConfig.ts`
- [X] T015 [P] Add shared frontend review API client scaffolding in `D:/src/MHG/chat-frontend/src/services/reviewApi.ts`
- [X] T016 [P] Add shared review state store scaffolding in `D:/src/MHG/chat-frontend/src/stores/reviewStore.ts`
- [X] T017 [P] Add review i18n namespace keys in `D:/src/MHG/chat-frontend/src/locales/en/review.json`, `D:/src/MHG/chat-frontend/src/locales/uk/review.json`, and `D:/src/MHG/chat-frontend/src/locales/ru/review.json`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Review AI Conversations for Safety and Quality (Priority: P1) 🎯 MVP

**Goal**: Let reviewers open anonymized sessions, score each assistant response, enforce low-score criteria feedback, and submit complete reviews.

**Independent Test**: Reviewer can open a pending session, score all assistant messages, receive enforcement for low-score criteria feedback, and submit successfully.

### Implementation for User Story 1

- [X] T018 [P] [US1] Implement queue filtering and sorting behavior in `D:/src/MHG/chat-backend/src/routes/review.queue.ts`
- [X] T019 [US1] Implement session detail retrieval with transcript and existing aggregates in `D:/src/MHG/chat-backend/src/routes/review.sessions.ts`
- [X] T020 [US1] Implement review start assignment lifecycle endpoint in `D:/src/MHG/chat-backend/src/routes/review.sessions.ts`
- [X] T021 [US1] Implement review submission validation (all assistant messages rated) in `D:/src/MHG/chat-backend/src/services/reviewAggregation.service.ts`
- [X] T022 [US1] Implement criteria feedback enforcement for threshold scores in `D:/src/MHG/chat-backend/src/services/reviewAggregation.service.ts`
- [X] T023 [P] [US1] Implement reviewer queue UI with status/risk/date/language filters in `D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewQueueView.tsx`
- [X] T024 [US1] Implement session review UI with per-message rating cards in `D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewSessionView.tsx`
- [X] T025 [US1] Implement low-score criteria feedback form behavior in `D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewSessionView.tsx`
- [X] T026 [US1] Implement submission state/error/success handling in `D:/src/MHG/chat-frontend/src/stores/reviewStore.ts`
- [X] T027 [US1] Add queue/session API contract alignment updates in `D:/src/MHG/client-spec/specs/003-chat-moderation-review/contracts/review-api.yaml`

**Checkpoint**: User Story 1 should be fully functional and independently verifiable.

---

## Phase 4: User Story 2 - Coordinate Multi-Reviewer Outcomes (Priority: P1)

**Goal**: Enforce minimum review counts, handle dispute detection, and complete tie-break resolution workflows.

**Independent Test**: A session remains in progress until minimum reviews are complete; high score spread transitions to disputed/tiebreaker and resolves to final status.

### Implementation for User Story 2

- [X] T028 [US2] Implement review-count gating and session status transitions in `D:/src/MHG/chat-backend/src/services/reviewAggregation.service.ts`
- [X] T029 [US2] Implement disagreement detection (`max-min` threshold) and disputed state in `D:/src/MHG/chat-backend/src/services/reviewAggregation.service.ts`
- [X] T030 [US2] Implement tiebreaker assignment and resolution flow in `D:/src/MHG/chat-backend/src/services/reviewAggregation.service.ts`
- [X] T031 [P] [US2] Implement reviewer blinding rules in session payloads in `D:/src/MHG/chat-backend/src/routes/review.sessions.ts`
- [X] T032 [US2] Implement assignment reservation expiry and return-to-pool logic in `D:/src/MHG/chat-backend/src/services/reviewQueue.service.ts`
- [X] T033 [P] [US2] Add multi-review progress and status indicators in `D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewQueueView.tsx`
- [X] T034 [US2] Add post-submission aggregate visibility and completion details in `D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewSessionView.tsx`
- [X] T035 [US2] Add disputed/tiebreaker status rendering in `D:/src/MHG/chat-frontend/src/stores/reviewStore.ts`
- [X] T036 [US2] Update session/review lifecycle contract definitions in `D:/src/MHG/client-spec/specs/003-chat-moderation-review/contracts/review-api.yaml`

**Checkpoint**: User Stories 1 and 2 operate independently and together.

---

## Phase 5: User Story 3 - Escalate High-Risk Sessions (Priority: P1)

**Goal**: Support high/medium safety flagging, escalation queue handling, and SLA-aware moderator workflows.

**Independent Test**: Reviewer can submit high/medium flags, moderator can acknowledge/resolve from escalation queue, and deadlines are visible/tracked.

### Implementation for User Story 3

- [X] T037 [US3] Implement risk-flag submission endpoint with severity and reason validation in `D:/src/MHG/chat-backend/src/routes/review.flags.ts`
- [X] T038 [US3] Implement escalation queue read endpoint with status/severity filters in `D:/src/MHG/chat-backend/src/routes/review.flags.ts`
- [X] T039 [US3] Implement acknowledge/resolve escalation endpoints in `D:/src/MHG/chat-backend/src/routes/review.flags.ts`
- [X] T040 [US3] Implement SLA deadline calculation and state updates in `D:/src/MHG/chat-backend/src/services/riskFlag.service.ts`
- [X] T041 [US3] Implement notification dispatch and delivery-state recording in `D:/src/MHG/chat-backend/src/services/riskFlag.service.ts`
- [X] T042 [P] [US3] Implement escalation list and actions UI in `D:/src/MHG/chat-frontend/src/features/workbench/review/EscalationQueue.tsx`
- [X] T043 [US3] Implement session-level risk-flag action UI in `D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewSessionView.tsx`
- [X] T044 [US3] Add escalation API integration and optimistic update handling in `D:/src/MHG/chat-frontend/src/services/reviewApi.ts`
- [X] T045 [US3] Align risk and escalation contract definitions in `D:/src/MHG/client-spec/specs/003-chat-moderation-review/contracts/risk-api.yaml`

**Checkpoint**: User Story 3 is independently functional.

---

## Phase 6: User Story 4 - Protect Privacy With Controlled Identity Reveal (Priority: P2)

**Goal**: Keep default anonymization and enable role-gated deanonymization request/approval with full auditability.

**Independent Test**: Reviewer sees anonymized identifiers by default, submits request, commander approves/denies, and audit evidence is generated.

### Implementation for User Story 4

- [X] T046 [US4] Enforce anonymized identity serialization for all reviewer-facing session responses in `D:/src/MHG/chat-backend/src/routes/review.sessions.ts`
- [X] T047 [US4] Implement deanonymization request creation endpoint in `D:/src/MHG/chat-backend/src/routes/review.deanonymization.ts`
- [X] T048 [US4] Implement deanonymization list endpoint for commander/admin roles in `D:/src/MHG/chat-backend/src/routes/review.deanonymization.ts`
- [X] T049 [US4] Implement deanonymization approve/deny resolution endpoint in `D:/src/MHG/chat-backend/src/routes/review.deanonymization.ts`
- [X] T050 [US4] Implement time-bounded reveal access and decision audit writes in `D:/src/MHG/chat-backend/src/services/deanonymization.service.ts`
- [X] T051 [P] [US4] Implement deanonymization request and approval UI in `D:/src/MHG/chat-frontend/src/features/workbench/review/DeanonymizationPanel.tsx`
- [X] T052 [US4] Implement role-gated deanonymization actions in frontend state management in `D:/src/MHG/chat-frontend/src/stores/reviewStore.ts`
- [X] T053 [US4] Align deanonymization endpoint contracts in `D:/src/MHG/client-spec/specs/003-chat-moderation-review/contracts/risk-api.yaml`

**Checkpoint**: User Story 4 is independently functional with auditable controls.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete cross-story admin operations, dashboards, accessibility, and rollout verification.

- [X] T054 Implement reviewer personal and team metrics endpoints in `D:/src/MHG/chat-backend/src/routes/review.dashboard.ts`
- [X] T055 [P] Implement admin review configuration CRUD endpoint logic in `D:/src/MHG/chat-backend/src/routes/admin.reviewConfig.ts`
- [X] T056 [P] Implement reviewer management endpoints in `D:/src/MHG/chat-backend/src/routes/admin.reviewConfig.ts`
- [X] T057 Implement reviewer and team dashboard UI in `D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewDashboard.tsx`
- [X] T058 [P] Implement accessibility and keyboard-navigation hardening in `D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewQueueView.tsx` and `D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewSessionView.tsx`
- [X] T059 [P] Implement final i18n copy parity for review workflows in `D:/src/MHG/chat-frontend/src/locales/en/review.json`, `D:/src/MHG/chat-frontend/src/locales/uk/review.json`, and `D:/src/MHG/chat-frontend/src/locales/ru/review.json`
- [X] T060 Align admin/dashboard contracts in `D:/src/MHG/client-spec/specs/003-chat-moderation-review/contracts/admin-api.yaml` and `D:/src/MHG/client-spec/specs/003-chat-moderation-review/contracts/review-api.yaml`
- [X] T061 Execute end-to-end validation checklist from `D:/src/MHG/client-spec/specs/003-chat-moderation-review/quickstart.md` and store evidence artifacts in `D:/src/MHG/client-spec/evidence/T058/`
- [X] T062 Measure and document queue and session load performance targets in `D:/src/MHG/chat-frontend/src/features/workbench/review/`
- [X] T063 Measure and document review submission/flag submission latency targets in `D:/src/MHG/chat-backend/src/routes/review.sessions.ts` and `D:/src/MHG/chat-backend/src/routes/review.flags.ts`
- [X] T064 Record before/after validation evidence for performance and accessibility checks in `D:/src/MHG/client-spec/evidence/T064/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all user stories
- **Phase 3 (US1)**: depends on Phase 2
- **Phase 4 (US2)**: depends on Phase 2 and integrates with US1 review state outputs
- **Phase 5 (US3)**: depends on Phase 2; can proceed in parallel with US2 after shared contracts are stable
- **Phase 6 (US4)**: depends on Phase 2; can proceed in parallel with US2/US3 with route-level coordination
- **Phase 7 (Polish)**: depends on completion of selected user stories

### User Story Dependencies

- **US1 (P1)**: no dependency on other stories after foundation; MVP anchor
- **US2 (P1)**: builds on review submission outputs from US1
- **US3 (P1)**: can run alongside US2 after foundational services are in place
- **US4 (P2)**: can run alongside US3; integrates with escalation workflows but remains independently testable

### Dependency Graph

`US1 -> US2`  
`US1 -> US3`  
`US3 -> US4` (for escalation-linked deanonymization scenarios)

---

## Parallel Execution Examples

## Parallel Example: User Story 1

```bash
Task: "T023 [P] [US1] Implement reviewer queue UI in D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewQueueView.tsx"
Task: "T018 [P] [US1] Implement queue filtering and sorting in D:/src/MHG/chat-backend/src/routes/review.queue.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T031 [P] [US2] Implement reviewer blinding rules in D:/src/MHG/chat-backend/src/routes/review.sessions.ts"
Task: "T033 [P] [US2] Add multi-review progress indicators in D:/src/MHG/chat-frontend/src/features/workbench/review/ReviewQueueView.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T042 [P] [US3] Implement escalation list/actions UI in D:/src/MHG/chat-frontend/src/features/workbench/review/EscalationQueue.tsx"
Task: "T041 [US3] Implement notification dispatch state in D:/src/MHG/chat-backend/src/services/riskFlag.service.ts"
```

## Parallel Example: User Story 4

```bash
Task: "T051 [P] [US4] Implement deanonymization request/approval UI in D:/src/MHG/chat-frontend/src/features/workbench/review/DeanonymizationPanel.tsx"
Task: "T050 [US4] Implement reveal access and audit writes in D:/src/MHG/chat-backend/src/services/deanonymization.service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational)
3. Complete Phase 3 (US1)
4. Validate US1 independently through queue -> score -> submit flow

### Incremental Delivery

1. Deliver US1 as reviewer MVP
2. Add US2 for multi-review quality governance
3. Add US3 for safety escalation operations
4. Add US4 for controlled deanonymization governance
5. Execute polish phase for dashboards, accessibility, i18n, and end-to-end evidence

### Parallel Team Strategy

1. Team completes Phases 1-2 together
2. After foundation:
   - Engineer A: US2 backend aggregation
   - Engineer B: US3 escalation backend/frontend
   - Engineer C: US4 deanonymization backend/frontend
3. Converge for Phase 7 polish and full validation

---

## Notes

- All tasks follow required checklist syntax: checkbox, task ID, optional `[P]`, optional `[US#]`, action with file path.
- User-story tasks include mandatory `[US#]` labels; setup/foundation/polish tasks omit story labels.
- Tasks are written for direct execution by an implementation agent without additional planning context.

## Implementation Status Notes

- Unit test status:
  - `chat-backend`: passing
  - `chat-frontend`: passing
- E2E status (`chat-ui/tests/e2e/review`):
  - Executed with Playwright; functional failures remain due to local auth/bootstrap assumptions (see `D:/src/MHG/client-spec/evidence/T058/e2e-review-validation.md`).
- Completion interpretation:
  - Task checkboxes represent implementation work completion.
  - Full release readiness still requires resolving E2E functional failures in a seeded/runtime-equivalent environment.
