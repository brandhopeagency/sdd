# Tasks: Chat Review Supervision & Group Management Enhancements

**Input**: Design documents from `/specs/011-chat-review-supervision/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Multi-repository web application:
- `chat-types/src/` — Shared TypeScript types
- `chat-backend/src/` — Express.js backend API
- `workbench-frontend/src/` — Reviewer/Admin React UI
- `chat-frontend/src/` — End-user chat React UI
- `chat-ui/tests/e2e/` — Playwright E2E tests

---

## Phase 1: Setup (Shared Types)

**Purpose**: Create feature branches and publish shared types that all repos depend on

- [ ] T001 Create feature branch `011-chat-review-supervision` from `develop` in all affected repos: chat-types, chat-backend, workbench-frontend, chat-frontend, chat-ui
- [ ] T002 [P] Add `SUPERVISOR` value to `UserRole` enum in chat-types/src/rbac.ts, positioned between `RESEARCHER` and `MODERATOR`
- [ ] T003 [P] Add new permissions `REVIEW_SUPERVISE`, `REVIEW_SUPERVISION_CONFIG`, `TAG_CREATE` to `Permission` enum in chat-types/src/rbac.ts
- [ ] T004 Update `ROLE_PERMISSIONS` mapping in chat-types/src/rbac.ts: add SUPERVISOR role with inherited RESEARCHER permissions + new permissions; add REVIEW_SUPERVISE and TAG_CREATE to MODERATOR; ensure OWNER has all permissions
- [ ] T005 [P] Add `SupervisorReview`, `SupervisorDecisionInput`, `SupervisionQueueItem`, `SupervisionContext`, `AwaitingFeedbackItem` interfaces in chat-types/src/review.ts
- [ ] T006 [P] Add `SupervisionPolicy` type, `SupervisionStatus` type, `GroupReviewConfig` interface, and `UpdateGroupReviewConfigInput` interface in chat-types/src/reviewConfig.ts
- [ ] T007 [P] Add `GradeDescription` and `UpdateGradeDescriptionInput` interfaces in chat-types/src/reviewConfig.ts
- [ ] T008 [P] Add `RAGCallDetail` and `RAGDocument` interfaces in chat-types/src/review.ts
- [ ] T009 Export all new types and interfaces from chat-types/src/index.ts
- [ ] T010 Bump chat-types version in chat-types/package.json, build, and verify all exports compile

---

## Phase 2: Foundational (Database & Middleware)

**Purpose**: Database migrations and middleware updates that MUST complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T011 Update chat-types dependency in chat-backend/package.json to pick up new types
- [ ] T012 [P] Create migration `xxx_add_supervisor_role.sql` in chat-backend/src/db/migrations/ to add 'supervisor' value to the user role enum type
- [ ] T013 [P] Create migration `xxx_add_grade_descriptions.sql` in chat-backend/src/db/migrations/ to create `grade_descriptions` table (score_level PK 1-10, description TEXT, updated_by FK, updated_at) and seed 10 rows from existing SCORE_LABELS
- [ ] T014 [P] Create migration `xxx_add_group_review_config.sql` in chat-backend/src/db/migrations/ to create `group_review_config` table (id, group_id UNIQUE FK, reviewer_count_override, supervision_policy, supervision_sample_percentage, timestamps)
- [ ] T015 [P] Create migration `xxx_extend_review_config_supervision.sql` in chat-backend/src/db/migrations/ to add `supervision_policy` (DEFAULT 'none') and `supervision_sample_percentage` (DEFAULT 100) columns to existing `review_config` table
- [ ] T016 [P] Create migration `xxx_extend_session_reviews_supervision.sql` in chat-backend/src/db/migrations/ to add `supervision_status` and `supervision_required` columns to existing `session_reviews` table
- [ ] T017 Create migration `xxx_add_supervisor_reviews.sql` in chat-backend/src/db/migrations/ to create `supervisor_reviews` table per data-model.md (id, session_review_id FK, supervisor_id FK, decision, comments, return_to_reviewer, revision_iteration, created_at) with UNIQUE(session_review_id, revision_iteration)
- [ ] T018 Update chat-backend/src/middleware/reviewAuth.ts to recognize `SUPERVISOR` role and `REVIEW_SUPERVISE`, `REVIEW_SUPERVISION_CONFIG`, `TAG_CREATE` permissions for route authorization

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Supervisor Second-Level Review (Priority: P1) 🎯 MVP

**Goal**: After a reviewer submits a review, it routes to a supervisor queue. Supervisors evaluate reviews in a 3-column interface (chat transcript | reviewer assessment | supervisor comment), approve or disapprove with comments, and optionally return for revision (max 2 cycles). Supervisor assessment takes precedence.

**Independent Test**: Submit a review as reviewer → verify it appears in supervisor queue → supervisor opens 3-column view → approves with comment → review marked approved. Second path: disapprove with return → reviewer sees feedback → revises → resubmits.

### Implementation for User Story 1

- [ ] T019 [US1] Create chat-backend/src/services/supervision.service.ts with methods: `determineSupervisionRequired(sessionId, groupId)` (evaluates policy), `routeToSupervision(reviewId)` (sets supervision_status), `getSupervisionQueue(filters, pagination)`, `getSupervisionContext(reviewId)` (returns chat + assessment + prior decisions), `submitDecision(reviewId, supervisorId, input)` (approve/disapprove/return logic with max 2 revision enforcement), `getAwaitingFeedback(reviewerId, pagination)`
- [ ] T020 [US1] Create chat-backend/src/routes/review.supervision.ts with endpoints per contracts/supervision-api.yaml: GET /api/review/supervision/queue (requires REVIEW_SUPERVISE), GET /api/review/supervision/:reviewId (context), POST /api/review/supervision/:reviewId/decision, GET /api/review/supervision/awaiting-feedback
- [ ] T021 [US1] Modify chat-backend/src/services/review.service.ts — after review submission completes, call `supervision.service.determineSupervisionRequired()` and if true, call `routeToSupervision()` to set supervision_status to 'pending_supervision'; if false, set to 'not_required'
- [ ] T022 [US1] Modify chat-backend/src/services/reviewScoring.service.ts — when calculating final session score, check if supervisor assessment exists and use supervisor's evaluation as authoritative when present
- [ ] T023 [US1] Register supervision routes in chat-backend/src/index.ts with appropriate middleware guards (requirePermission REVIEW_SUPERVISE)
- [ ] T024 [US1] Update chat-types dependency in workbench-frontend/package.json
- [ ] T025 [US1] Create workbench-frontend/src/stores/supervisionStore.ts — Zustand store with state for supervision queue items, current supervision context, decision submission, awaiting feedback list; actions: fetchQueue, fetchContext, submitDecision, fetchAwaitingFeedback
- [ ] T026 [P] [US1] Create workbench-frontend/src/features/workbench/review/components/SupervisorCommentPanel.tsx — comment textarea, approve/disapprove buttons, optional "return to reviewer" checkbox on disapprove, revision iteration indicator, submit handler
- [ ] T027 [P] [US1] Create workbench-frontend/src/features/workbench/review/components/ReviewerAssessmentColumn.tsx — displays reviewer's scores per message, criteria feedback, overall comment, average score; read-only view for supervisor
- [ ] T028 [US1] Create workbench-frontend/src/features/workbench/review/SupervisorReviewView.tsx — CSS Grid 3-column layout (chat transcript left, reviewer assessment center, supervisor comment right); responsive: tabbed layout below 1024px; loads SupervisionContext from store; integrates SupervisorCommentPanel and ReviewerAssessmentColumn
- [ ] T029 [US1] Add route for SupervisorReviewView in workbench-frontend/src/routes/ at path `/review/supervision/:reviewId`
- [ ] T030 [US1] Add i18n translation keys for supervision flow in workbench-frontend/src/locales/ (uk, en, ru): supervision queue labels, approve/disapprove buttons, return-to-reviewer checkbox, revision iteration text, comment placeholder, status labels

**Checkpoint**: Supervisor second-level review is fully functional and testable independently

---

## Phase 4: User Story 2 — Grade Help Tooltip & Flexible Criteria Feedback (Priority: P1)

**Goal**: Question-mark icon next to each grade shows a tooltip with score description. Criteria feedback changes from requiring all 5 to requiring at least 1 checked checkbox with optional comments.

**Independent Test**: Rate an AI response → hover question mark → see description tooltip. Select low score → see criteria as checkboxes → check 1 → submit succeeds. Try submitting with 0 checked → blocked.

### Implementation for User Story 2

- [ ] T031 [US2] Create chat-backend/src/services/gradeDescription.service.ts with methods: `listAll()` (returns 10 grade descriptions), `update(scoreLevel, description, updatedById)` (requires REVIEW_SUPERVISION_CONFIG or REVIEW_CONFIGURE)
- [ ] T032 [US2] Create chat-backend/src/routes/review.gradeDescriptions.ts with endpoints per contracts/grade-description-api.yaml: GET /api/review/grade-descriptions, PUT /api/review/grade-descriptions/:scoreLevel (requires supervisor or admin permissions)
- [ ] T033 [US2] Register grade description routes in chat-backend/src/index.ts
- [ ] T034 [US2] Modify chat-backend/src/services/review.service.ts — change criteria feedback validation from requiring all 5 criteria to requiring at least 1 checked criterion; make feedback_text optional per criterion
- [ ] T035 [P] [US2] Create workbench-frontend/src/features/workbench/review/components/GradeTooltip.tsx — lightweight tooltip component positioned relative to score selector; fetches grade descriptions from API; displays description for hovered/tapped score level; supports hover (desktop) and tap (mobile)
- [ ] T036 [US2] Modify workbench-frontend/src/features/workbench/review/components/ScoreSelector.tsx — add question-mark help icon (lucide-react HelpCircle) next to each score value; on hover/tap show GradeTooltip; pass score level to tooltip
- [ ] T037 [US2] Modify workbench-frontend/src/features/workbench/review/components/CriteriaFeedbackForm.tsx — change each criterion from required text field to checkbox with optional comment textarea; validate at least 1 checkbox checked before submission; only submit checked criteria
- [ ] T038 [US2] Add i18n translation keys for grade tooltips and criteria checkboxes in workbench-frontend/src/locales/ (uk, en, ru): tooltip labels, criterion checkbox labels, validation message for "at least one required"

**Checkpoint**: Grade tooltips and flexible criteria are functional and testable independently

---

## Phase 5: User Story 3 — Configurable Reviewer Count per Group (Priority: P1)

**Goal**: Admin can set reviewer count globally and per group. Per-group overrides take precedence. Changes apply only to new sessions.

**Independent Test**: Set global count to 3, set group override to 5 → verify sessions from that group require 5 reviews, others require 3.

### Implementation for User Story 3

- [ ] T039 [US3] Modify chat-backend/src/services/reviewConfig.service.ts — add methods: `getGroupConfig(groupId)`, `upsertGroupConfig(groupId, input)`, `deleteGroupConfig(groupId)`, `listGroupConfigs()`, `resolveEffectiveConfig(groupId)` (checks group override then global fallback for reviewer count and supervision policy)
- [ ] T040 [US3] Modify chat-backend/src/routes/admin.reviewConfig.ts — add endpoints per contracts/reviewer-config-api.yaml: GET/PUT/DELETE /api/admin/review-config/groups/:groupId, GET /api/admin/review-config/groups; extend PATCH /api/admin/review-config to accept supervision_policy and supervision_sample_percentage fields
- [ ] T041 [US3] Modify chat-backend/src/services/reviewQueue.service.ts — when a session enters the queue, call `resolveEffectiveConfig(session.groupId)` to determine required reviewer count and stamp it on the session record
- [ ] T042 [US3] Modify workbench-frontend/src/features/workbench/review/ReviewConfigPage.tsx — add per-group configuration section: list of groups with their overrides, form to set/edit/remove reviewer count and supervision policy per group, display effective values with source indicator (global/group)
- [ ] T043 [US3] Add i18n translation keys for per-group config in workbench-frontend/src/locales/ (uk, en, ru): group config labels, override indicator, remove override button, supervision policy options

**Checkpoint**: Per-group reviewer count and supervision policy are configurable and correctly applied

---

## Phase 6: User Story 4 — Supervisor-Only Tag Creation (Priority: P2)

**Goal**: Only supervisors and admins can create new tags. Reviewers can browse and apply existing tags but cannot create new ones.

**Independent Test**: Log in as reviewer → open tag selector → no create option. Log in as supervisor → create tag succeeds → tag visible to reviewers.

### Implementation for User Story 4

- [ ] T044 [US4] Modify chat-backend/src/routes/review.sessionTags.ts — change tag creation endpoint authorization from TAG_MANAGE to TAG_CREATE permission; keep TAG_ASSIGN_SESSION and TAG_ASSIGN_USER available to reviewers
- [ ] T045 [US4] Modify workbench-frontend/src/features/workbench/review/components/TagInput.tsx — check user permissions; hide "create new tag" input/button when user lacks TAG_CREATE permission; show "Tag not found — contact a supervisor to create it" when search yields no results for non-supervisor users
- [ ] T046 [US4] Modify workbench-frontend/src/features/workbench/review/TagManagementPage.tsx — conditionally show create/edit/delete controls based on TAG_CREATE and TAG_MANAGE permissions; supervisor sees create, admin sees full CRUD
- [ ] T047 [US4] Add i18n translation keys for tag restriction messages in workbench-frontend/src/locales/ (uk, en, ru): "contact supervisor" message, permission-based button labels

**Checkpoint**: Tag creation is restricted to supervisors/admins; reviewers can only apply existing tags

---

## Phase 7: User Story 5 — Waiting for Reviews/Supervision Tab (Priority: P2)

**Goal**: New "Awaiting Supervision" tab for supervisors to find work. New "Awaiting Feedback" tab for reviewers to track their pending reviews.

**Independent Test**: Submit reviews from multiple reviewers → verify they appear in supervisor's Awaiting Supervision tab. Each reviewer sees their own reviews in Awaiting Feedback tab.

**Note**: Depends on US1 supervision infrastructure (backend endpoints created in T020)

### Implementation for User Story 5

- [ ] T048 [P] [US5] Create workbench-frontend/src/features/workbench/review/SupervisorQueueTab.tsx — fetches supervision queue from store, renders list of reviews pending supervision sorted by submission time, each item shows reviewer name, group, message count, revision iteration, click opens SupervisorReviewView
- [ ] T049 [P] [US5] Create workbench-frontend/src/features/workbench/review/AwaitingFeedbackTab.tsx — fetches awaiting feedback from store for current user, renders list of submitted reviews with supervision status (pending/revision_requested/approved/disapproved), shows latest supervisor comment when returned
- [ ] T050 [US5] Modify workbench-frontend/src/features/workbench/review/ReviewQueueView.tsx — add "Awaiting Supervision" tab (visible to users with REVIEW_SUPERVISE permission) and "Awaiting Feedback" tab (visible to all reviewers); integrate SupervisorQueueTab and AwaitingFeedbackTab components
- [ ] T051 [US5] Add i18n translation keys for new tabs in workbench-frontend/src/locales/ (uk, en, ru): tab labels, empty state messages, status labels (pending supervision, revision requested, approved, disapproved)

**Checkpoint**: Supervision pipeline is visible through dedicated queue tabs for both supervisors and reviewers

---

## Phase 8: User Story 6 — RAG Call Details (Priority: P2)

**Goal**: Show RAG retrieval details (sources, relevance scores, query) on AI responses. In review: visible to all reviewers. In chat: visible only to tester-tagged users.

**Independent Test**: Open a session with RAG-enabled AI responses in review → expand RAG panel → see sources. Log in as tester in chat → see RAG toggle. Log in as regular user → no RAG controls.

### Implementation for User Story 6

- [ ] T052 [US6] Create chat-backend/src/services/ragDetail.service.ts — method `extractRAGDetails(messageMetadata)` that parses RAG retrieval data from existing message metadata JSON field; returns RAGCallDetail or null
- [ ] T053 [US6] Modify chat-backend/src/routes/review.sessions.ts — when returning session messages for review, call ragDetail.service to include RAG details on assistant messages that have retrieval metadata; per contracts/rag-detail-api.yaml
- [ ] T054 [US6] Modify chat-backend/src/routes/chat.ts — when returning chat session messages, check if authenticated user has a tester tag; if yes, include RAG details; if no, omit RAG metadata from response
- [ ] T055 [P] [US6] Create workbench-frontend/src/features/workbench/review/components/RAGDetailPanel.tsx — expandable/collapsible panel showing retrieval query, list of retrieved documents with title, relevance score bar, and content snippet; hidden when ragDetails is null
- [ ] T056 [US6] Modify workbench-frontend/src/features/workbench/review/ReviewSessionView.tsx — for each assistant message, render RAGDetailPanel below the message content when ragDetails is present; collapsed by default
- [ ] T057 [US6] Update chat-types dependency in chat-frontend/package.json
- [ ] T058 [P] [US6] Create chat-frontend/src/features/chat/components/RAGDetailPanel.tsx — same expandable panel as workbench version; shows sources, scores, query
- [ ] T059 [US6] Modify chat-frontend/src/features/chat/MessageBubble.tsx — for assistant messages, conditionally render RAG toggle icon and RAGDetailPanel when ragDetails field is present in message data (only populated by backend for tester-tagged users)
- [ ] T060 [US6] Add i18n translation keys for RAG details in workbench-frontend/src/locales/ and chat-frontend/src/locales/ (uk, en, ru): panel header, "Sources", "Relevance", "Query", "No retrieval data available", toggle label

**Checkpoint**: RAG details are visible in review (all reviewers) and chat (testers only)

---

## Phase 9: User Story 7 — Add New Users to Groups (Priority: P2)

**Goal**: Group managers can add new users who don't yet have an account — system creates the account inline and sends an invitation.

**Independent Test**: As group admin → add user with new email → fill name/role form → submit → account created, user in group, invitation sent. Try existing email → user added directly.

### Implementation for User Story 7

- [ ] T061 [US7] Modify chat-backend/src/services/group.service.ts — extend `addUserToGroup()` to accept a `newUser` payload (email, name, role); when email doesn't match an existing user, create account via user service and add to group in a single transaction; trigger invitation notification
- [ ] T062 [US7] Modify chat-backend/src/routes/group.ts — extend POST /api/group/users to accept `AddExistingUserInput` or `AddNewUserInput` per contracts/group-user-creation-api.yaml; add GET /api/group/users/check-email endpoint for pre-flight email existence check
- [ ] T063 [US7] Modify workbench-frontend/src/features/workbench/group/GroupUsersView.tsx — update add-user flow: add email input with check-email pre-flight; if existing user found, show name and add directly; if not found, show inline form for name, role; submit creates and adds
- [ ] T064 [US7] Modify workbench-frontend/src/features/workbench/users/CreateUserModal.tsx — support receiving group context (groupId) so that after user creation the user is automatically added to the specified group
- [ ] T065 [US7] Add i18n translation keys for group user creation in workbench-frontend/src/locales/ (uk, en, ru): "User not found — create new account", name/role fields, invitation sent confirmation, "already a member" message

**Checkpoint**: New users can be created inline during group member addition

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Responsive validation, final integration, deployment

- [ ] T066 Validate responsive behavior of SupervisorReviewView 3-column layout at 320px (stacked), 768px (tabbed), 1024px+ (3-column) in workbench-frontend
- [ ] T067 [P] Validate GradeTooltip hover (desktop) and tap (mobile) behavior across breakpoints in workbench-frontend
- [ ] T068 [P] Validate Awaiting Supervision and Awaiting Feedback tabs render correctly on mobile viewports in workbench-frontend
- [ ] T069 Run quickstart.md validation: verify all critical paths work end-to-end (supervision flow, grade tooltips, criteria checkboxes, per-group config, tag restriction, RAG details, group user creation)
- [ ] T070 Open PRs from `011-chat-review-supervision` to `develop` in all affected repos (chat-types, chat-backend, workbench-frontend, chat-frontend, chat-ui), obtain required reviews, and merge only after all required checks pass
- [ ] T071 Verify unit and UI/E2E test gates passed for all merged PRs
- [ ] T072 Capture post-deploy smoke evidence: GET /api/review/supervision/queue, POST /api/review/supervision/:reviewId/decision, GET /api/review/grade-descriptions, POST /api/group/users (new user), GET /api/chat/sessions/:id/messages (tester RAG)
- [ ] T073 Delete merged remote feature branches in all repos and purge local `011-chat-review-supervision` branches
- [ ] T074 Sync local `develop` to `origin/develop` in each affected repository

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Phase 2 completion
  - US1 (Phase 3), US2 (Phase 4), US3 (Phase 5): P1 stories, can proceed in parallel
  - US4 (Phase 6), US6 (Phase 8), US7 (Phase 9): P2 stories, can proceed in parallel
  - US5 (Phase 7): Depends on US1 backend (T019-T023) being complete
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (Supervisor Review)**: Can start after Phase 2 — No dependencies on other stories
- **US2 (Grade Tooltips & Criteria)**: Can start after Phase 2 — No dependencies on other stories
- **US3 (Configurable Reviewer Count)**: Can start after Phase 2 — No dependencies on other stories
- **US4 (Tag Creation Restriction)**: Can start after Phase 2 — No dependencies on other stories
- **US5 (Waiting Tabs)**: Depends on US1 backend (supervision queue + awaiting-feedback endpoints)
- **US6 (RAG Call Details)**: Can start after Phase 2 — No dependencies on other stories
- **US7 (Add New Users)**: Can start after Phase 2 — No dependencies on other stories

### Within Each User Story

- Backend services before routes
- Routes before frontend components
- Stores before views
- Components before parent views
- i18n keys alongside or after components

### Parallel Opportunities

- All Phase 1 types tasks (T002-T008) can run in parallel
- All Phase 2 migration tasks (T012-T016) can run in parallel
- After Phase 2: US1, US2, US3 can start in parallel (3 P1 stories)
- After Phase 2: US4, US6, US7 can start in parallel (independent P2 stories)
- US5 starts after US1 backend completes (T019-T023)
- Within US1: SupervisorCommentPanel (T026) and ReviewerAssessmentColumn (T027) in parallel
- Within US6: workbench RAGDetailPanel (T055) and chat RAGDetailPanel (T058) in parallel
- Within US5: SupervisorQueueTab (T048) and AwaitingFeedbackTab (T049) in parallel

---

## Parallel Example: User Story 1

```bash
# Phase 1 types (all parallel):
T002: Add SUPERVISOR to UserRole enum in chat-types/src/rbac.ts
T003: Add new permissions in chat-types/src/rbac.ts
T005: Add SupervisorReview types in chat-types/src/review.ts
T006: Add SupervisionPolicy types in chat-types/src/reviewConfig.ts
T007: Add GradeDescription types in chat-types/src/reviewConfig.ts
T008: Add RAGCallDetail types in chat-types/src/review.ts

# Phase 2 migrations (all parallel):
T012: Migration: add supervisor role
T013: Migration: create grade_descriptions
T014: Migration: create group_review_config
T015: Migration: extend review_config
T016: Migration: extend session_reviews

# US1 frontend components (parallel pair):
T026: Create SupervisorCommentPanel.tsx
T027: Create ReviewerAssessmentColumn.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (chat-types)
2. Complete Phase 2: Foundational (migrations + middleware)
3. Complete Phase 3: User Story 1 (Supervisor Review)
4. **STOP and VALIDATE**: Test supervisor approve/disapprove/return flow
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Supervisor Review) → Test → Deploy (MVP!)
3. US2 (Grade Tooltips + Criteria) → Test → Deploy
4. US3 (Per-Group Config) → Test → Deploy
5. US5 (Waiting Tabs, needs US1) → Test → Deploy
6. US4, US6, US7 (independent P2 stories) → Test → Deploy
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers after Phase 2:

- Developer A: US1 (Supervisor Review) → then US5 (Waiting Tabs)
- Developer B: US2 (Grade Tooltips) + US4 (Tag Restriction)
- Developer C: US3 (Per-Group Config) + US7 (Add New Users)
- Developer D: US6 (RAG Details)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable (except US5 which depends on US1 backend)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Never merge directly into `develop`; use reviewed PRs from feature/bugfix branches only
- After merge, delete remote/local feature branches and sync local `develop`
- chat-types must be built and version-bumped before other repos consume it
