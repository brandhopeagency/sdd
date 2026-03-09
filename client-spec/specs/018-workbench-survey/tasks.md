# Tasks: Workbench Survey Module

**Input**: Design documents from `/specs/018-workbench-survey/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Jira Epic**: [MTB-405](https://mentalhelpglobal.atlassian.net/browse/MTB-405)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature branches, add shared types and permissions across repos

**Jira Task**: [MTB-412](https://mentalhelpglobal.atlassian.net/browse/MTB-412)

- [x] T001 Create `018-workbench-survey` branch from `develop` in `chat-types`, `chat-backend`, `workbench-frontend`, `chat-frontend`, and `chat-ui` repositories
- [x] T002 Define survey type enums (`SurveySchemaStatus`, `SurveyInstanceStatus`, `SurveyQuestionType`) in `chat-types/src/survey.ts`
- [x] T003 Define survey entity interfaces (`SurveySchema`, `SurveyQuestion`, `SurveyQuestionInput`, `SurveyInstance`, `SurveyResponse`, `SurveyAnswer`, `SurveySchemaListItem`, `SurveyInstanceListItem`, `PendingSurvey`) in `chat-types/src/survey.ts`
- [x] T004 Add survey permissions (`SURVEY_SCHEMA_MANAGE`, `SURVEY_INSTANCE_MANAGE`, `SURVEY_INSTANCE_VIEW`, `SURVEY_SCHEMA_ARCHIVE`, `SURVEY_RESPONSE_VIEW`) to `Permission` enum in `chat-types/src/rbac.ts`
- [x] T005 Export all survey types and permissions from `chat-types/src/index.ts`
- [x] T006 Build and publish `chat-types` package (`npm run build` in `chat-types/`)
- [x] T007 [P] Update `@mentalhelpglobal/chat-types` dependency in `chat-backend/package.json` and run `npm install`
- [x] T008 [P] Update `@mentalhelpglobal/chat-types` dependency in `workbench-frontend/package.json` and run `npm install`
- [x] T009 [P] Update `@mentalhelpglobal/chat-types` dependency in `chat-frontend/package.json` and run `npm install`

---

## Phase 2: Foundational (Backend Database + Service Scaffolding)

**Purpose**: Database migration and core service/route scaffolding that MUST be complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

**Jira Task**: [MTB-413](https://mentalhelpglobal.atlassian.net/browse/MTB-413)

- [x] T010 Create database migration `chat-backend/src/db/migrations/024_create_survey_tables.sql` with `survey_schemas`, `survey_instances`, `survey_responses` tables, CHECK constraints, and indexes per data-model.md
- [x] T011 Verify migration applies successfully via `npm run dev` startup in `chat-backend/` (tables created, constraints active)
- [x] T012 [P] Create `chat-backend/src/services/surveySchema.service.ts` with stub exports for all schema operations (create, getById, list, update, publish, archive, restore, clone, delete)
- [x] T013 [P] Create `chat-backend/src/services/surveyInstance.service.ts` with stub exports for all instance operations (create, getById, list, close, getResponses)
- [x] T014 [P] Create `chat-backend/src/services/surveyResponse.service.ts` with stub exports for gate-check, response CRUD, and partial save
- [x] T015 [P] Create `chat-backend/src/routes/survey.schemas.ts` with Express Router skeleton — mount all schema endpoints with `authenticate`, `requireActiveAccount`, `workbenchGuard`, and `requirePermission(Permission.SURVEY_SCHEMA_MANAGE)` middleware
- [x] T016 [P] Create `chat-backend/src/routes/survey.instances.ts` with Express Router skeleton — mount all instance endpoints with appropriate permission middleware (`SURVEY_INSTANCE_MANAGE` for write, `SURVEY_INSTANCE_VIEW` for read)
- [x] T017 [P] Create `chat-backend/src/routes/survey.gate.ts` with Express Router skeleton — mount gate-check and response endpoints with `authenticate` and `requireActiveAccount` middleware
- [x] T018 Mount survey routes in `chat-backend/src/index.ts`: `/api/workbench/survey-schemas`, `/api/workbench/survey-instances`, `/api/chat/gate-check`, `/api/chat/survey-responses`

### Extensions (v2) — Invalidation + Add-to-memory + Group context

- [x] T104 Add new migration `chat-backend/src/db/migrations/025_extend_surveys_invalidation_memory.sql` to add `survey_instances.add_to_memory`, `survey_responses.group_id`, invalidation fields (`invalidated_at`, `invalidated_by`, `invalidation_reason`), and supporting indexes (incl. `(instance_id, group_id)` and partial gate index on `invalidated_at IS NULL`) — MTB-425
- [x] T105 [P] Update shared types in `chat-types/src/survey.ts` to include `SurveyInstance.addToMemory` and `SurveyResponse.groupId/invalidatedAt/invalidatedBy/invalidationReason`; export in `chat-types/src/index.ts`; bump and publish package — MTB-427
- [x] T106 [P] Update `@mentalhelpglobal/chat-types` dependency to the new published version in `chat-backend/package.json`, `workbench-frontend/package.json`, and `chat-frontend/package.json` — MTB-428

**Checkpoint**: Database tables exist, routes are registered (return 501 stubs), middleware wired

---

## Phase 3: User Story 1 — Researcher Authors a Survey Schema (Priority: P1) 🎯 MVP

**Jira Story**: [MTB-406](https://mentalhelpglobal.atlassian.net/browse/MTB-406)

**Goal**: Researchers can create, edit, publish, and view survey schemas with ordered typed questions in the workbench

**Independent Test**: Create a schema in the workbench, add questions of each type, reorder them, publish, and confirm immutability (PATCH returns 403)

### Backend Implementation — [MTB-414](https://mentalhelpglobal.atlassian.net/browse/MTB-414)

- [x] T019 [US1] Implement `createSchema(title, description, questions, createdBy)` in `chat-backend/src/services/surveySchema.service.ts` — INSERT into `survey_schemas`, generate UUIDs for questions, validate question type constraints (options required for choice types, validation only for free_text)
- [x] T020 [US1] Implement `getSchemaById(id)` in `chat-backend/src/services/surveySchema.service.ts` — SELECT with all fields
- [x] T021 [US1] Implement `listSchemas(statusFilter?)` in `chat-backend/src/services/surveySchema.service.ts` — default excludes archived; optional `?status=archived` filter
- [x] T022 [US1] Implement `updateSchema(id, updates)` in `chat-backend/src/services/surveySchema.service.ts` — enforce draft-only (return 403 if published/archived); validate question constraints; recompute contiguous order values
- [x] T023 [US1] Implement `publishSchema(id)` in `chat-backend/src/services/surveySchema.service.ts` — enforce draft status, require ≥ 1 question (422 if zero), set `status = 'published'`, set `published_at = now()`
- [x] T024 [US1] Wire all schema CRUD and publish handlers in `chat-backend/src/routes/survey.schemas.ts` — replace stubs with service calls; return `{ success, data }` JSON responses with appropriate error codes (403, 404, 422)

### Workbench Frontend Implementation — [MTB-415](https://mentalhelpglobal.atlassian.net/browse/MTB-415)

- [x] T025 [P] [US1] Create survey API client functions (`createSchema`, `getSchema`, `listSchemas`, `updateSchema`, `publishSchema`) in `workbench-frontend/src/services/surveyApi.ts` using `apiFetch` from `@mentalhelpglobal/chat-frontend-common`
- [x] T026 [P] [US1] Create Zustand survey store with schema list state, loading/error flags, and CRUD actions in `workbench-frontend/src/stores/surveyStore.ts`
- [x] T027 [US1] Create `SurveySchemaListView` component in `workbench-frontend/src/features/workbench/surveys/SurveySchemaListView.tsx` — table with Title, Status badge, Question count, Created date, Published date; actions column (Edit, Clone, Delete); default excludes archived; toggle for archived view
- [x] T028 [US1] Create `SchemaStatusBadge` component in `workbench-frontend/src/features/workbench/surveys/components/SchemaStatusBadge.tsx` — renders draft/published/archived with appropriate colors
- [x] T029 [US1] Create `QuestionEditor` component in `workbench-frontend/src/features/workbench/surveys/components/QuestionEditor.tsx` — type selector dropdown, text input, required toggle; conditional rendering: option list editor for choice types, validation fields (regex, minLength, maxLength) for free_text, nothing for boolean; riskFlag toggle
- [x] T030 [US1] Create `OptionListEditor` component in `workbench-frontend/src/features/workbench/surveys/components/OptionListEditor.tsx` — add/remove/reorder options for single_choice and multi_choice questions
- [x] T031 [US1] Install `@dnd-kit/core` and `@dnd-kit/sortable` in `workbench-frontend/package.json`
- [x] T032 [US1] Create `QuestionList` component with drag-to-reorder in `workbench-frontend/src/features/workbench/surveys/components/QuestionList.tsx` — uses @dnd-kit for sortable list; add question button; remove question button; disabled in published/archived state
- [x] T033 [US1] Create `PublishConfirmModal` component in `workbench-frontend/src/features/workbench/surveys/components/PublishConfirmModal.tsx` — warns about immutability before confirming publish
- [x] T034 [US1] Create `SurveySchemaEditorView` component in `workbench-frontend/src/features/workbench/surveys/SurveySchemaEditorView.tsx` — title/description fields, QuestionList, Publish button (disabled until ≥ 1 question), read-only mode for published/archived schemas with Clone button
- [x] T035 [US1] Add survey routes to `workbench-frontend/src/features/workbench/WorkbenchShell.tsx` — `/workbench/surveys/schemas` → `SurveySchemaListView`, `/workbench/surveys/schemas/:id/edit` → `SurveySchemaEditorView`; wrap in `SubRouteGuard` with `Permission.SURVEY_SCHEMA_MANAGE`
- [x] T036 [US1] Add "Surveys" navigation item to workbench sidebar in `workbench-frontend/src/features/workbench/WorkbenchLayout.tsx` with `Permission.SURVEY_SCHEMA_MANAGE` guard
- [x] T037 [US1] Add survey-related i18n keys (schema list labels, editor labels, publish confirmation, status names) to `workbench-frontend/src/locales/en.json`, `uk.json`, and `ru.json`

**Checkpoint**: Researcher can create a draft schema, add/reorder/edit typed questions, publish, and see immutability enforced. Full vertical slice through types → backend → frontend.

---

## Phase 4: User Story 2 — Researcher Deploys a Survey Instance (Priority: P1)

**Jira Story**: [MTB-407](https://mentalhelpglobal.atlassian.net/browse/MTB-407)

**Goal**: Researchers can create time-boxed, group-scoped survey instances from published schemas, with automatic status transitions

**Independent Test**: Create an instance from a published schema with valid groups and dates, verify snapshot is frozen, verify auto-transitions fire within 60 seconds

### Backend Implementation — [MTB-416](https://mentalhelpglobal.atlassian.net/browse/MTB-416)

- [x] T038 [US2] Implement `createInstance(schemaId, groupIds, priority, startDate, expirationDate, createdBy)` in `chat-backend/src/services/surveyInstance.service.ts` — validate schema is published (422 otherwise), validate dates (expirationDate > startDate, both required), validate groupIds non-empty, create deep-copy `schemaSnapshot`, INSERT into `survey_instances`
- [x] T039 [US2] Implement `getInstanceById(id)` in `chat-backend/src/services/surveyInstance.service.ts` — SELECT with snapshot, include `completedCount` via subquery on `survey_responses WHERE is_complete = true`
- [x] T040 [US2] Implement `listInstances(statusFilter?, schemaIdFilter?)` in `chat-backend/src/services/surveyInstance.service.ts` — include `completedCount` aggregate per instance
- [x] T041 [US2] Implement `closeInstance(id)` in `chat-backend/src/services/surveyInstance.service.ts` — validate status is `active` (422 otherwise), set `status = 'closed'`, set `closed_at = now()`
- [x] T042 [US2] Create scheduled survey status job in `chat-backend/src/jobs/surveyStatusJob.ts` — `setInterval` with configurable interval (`SURVEY_JOB_INTERVAL_SECONDS`, default 60); run two idempotent UPDATE queries: draft → active (where `start_date <= now()`), active → expired (where `expiration_date <= now()`); log transitions
- [x] T043 [US2] Start survey status job in `chat-backend/src/index.ts` alongside existing `expireOldSessions` interval
- [x] T044 [US2] Wire all instance handlers in `chat-backend/src/routes/survey.instances.ts` — replace stubs with service calls; return `{ success, data }` with appropriate error codes

### Workbench Frontend Implementation — [MTB-417](https://mentalhelpglobal.atlassian.net/browse/MTB-417)

- [x] T045 [P] [US2] Add instance API client functions (`createInstance`, `getInstance`, `listInstances`, `closeInstance`) to `workbench-frontend/src/services/surveyApi.ts`
- [x] T046 [P] [US2] Add instance state (list, loading, CRUD actions) to survey Zustand store in `workbench-frontend/src/stores/surveyStore.ts`
- [x] T047 [US2] Create `InstanceStatusBadge` component in `workbench-frontend/src/features/workbench/surveys/components/InstanceStatusBadge.tsx` — renders draft/active/expired/closed with appropriate colors
- [x] T048 [US2] Create `InstanceCreateForm` component in `workbench-frontend/src/features/workbench/surveys/components/InstanceCreateForm.tsx` — schema picker (published only), group multi-select, priority integer input, start/expiry datetime pickers (expiry disables dates ≤ start), submit button
- [x] T049 [US2] Create `SurveyInstanceListView` component in `workbench-frontend/src/features/workbench/surveys/SurveyInstanceListView.tsx` — table with Schema title, Status badge, Groups, Start date, Expiry date, Completed count; Create button opens InstanceCreateForm
- [x] T050 [US2] Create `SurveyInstanceDetailView` component in `workbench-frontend/src/features/workbench/surveys/SurveyInstanceDetailView.tsx` — read-only snapshot display, group list, timing info, Close button (active only)
- [x] T051 [US2] Add instance routes to `workbench-frontend/src/features/workbench/WorkbenchShell.tsx` — `/workbench/surveys/instances` → `SurveyInstanceListView`, `/workbench/surveys/instances/:id` → `SurveyInstanceDetailView`; wrap in `SubRouteGuard` with `Permission.SURVEY_INSTANCE_MANAGE`
- [x] T052 [US2] Add instance-related i18n keys to `workbench-frontend/src/locales/en.json`, `uk.json`, and `ru.json`

**Checkpoint**: Researcher can create instances from published schemas, see auto-transitions, and manually close active instances. Snapshot is frozen and verified.

### Extensions (v2) — Instance-level “Add to memory” toggle

- [x] T107 [US2] Persist `addToMemory` on instance create in `chat-backend/src/services/surveyInstance.service.ts` and include it in instance list/detail DTOs — MTB-426
- [x] T108 [US2] Accept and validate `addToMemory` in `chat-backend/src/routes/survey.instances.ts` POST create handler; default false — MTB-429
- [x] T109 [US2] Add `addToMemory` field to workbench API client + store in `workbench-frontend/src/services/surveyApi.ts` and `workbench-frontend/src/stores/surveyStore.ts` — MTB-432
- [x] T110 [US2] Add “Add to memory” toggle to `workbench-frontend/src/features/workbench/surveys/components/InstanceCreateForm.tsx` and send it on create — MTB-433
- [x] T111 [US2] Display “Add to memory” state in instance detail view `workbench-frontend/src/features/workbench/surveys/SurveyInstanceDetailView.tsx` (read-only) — MTB-431

---

## Phase 5: User Story 3 — Officer Completes Survey Gate Before Chat (Priority: P1)

**Jira Story**: [MTB-408](https://mentalhelpglobal.atlassian.net/browse/MTB-408)

**Goal**: Officers in assigned groups see a blocking survey gate before chat, complete questions, and gain chat access

**Independent Test**: Assign a survey to a group, log in as a user in that group, verify gate blocks chat, complete the survey, verify chat loads

### Backend Implementation — [MTB-419](https://mentalhelpglobal.atlassian.net/browse/MTB-419)

- [x] T053 [US3] Implement `getGateCheck(userGroupIds, pseudonymousId)` in `chat-backend/src/services/surveyResponse.service.ts` — query active instances where `group_ids && userGroupIds` and no complete response for `pseudonymousId`; order by `priority ASC, start_date ASC`; include schemaSnapshot and existing partial response if any
- [x] T054 [US3] Implement `createOrUpdateResponse(instanceId, pseudonymousId, answers, isComplete)` in `chat-backend/src/services/surveyResponse.service.ts` — UPSERT using `ON CONFLICT (instance_id, pseudonymous_id)`; validate answer types against schemaSnapshot questions; if `isComplete = true`, validate all required questions are answered, set `completed_at = now()`
- [x] T055 [US3] Implement `getResponseByInstance(instanceId, pseudonymousId)` in `chat-backend/src/services/surveyResponse.service.ts` — return existing response (partial or complete) for resuming
- [x] T056 [US3] Implement `savePartialProgress(responseId, answers)` in `chat-backend/src/services/surveyResponse.service.ts` — UPDATE answers JSONB, last-write-wins semantics
- [x] T057 [US3] Wire all gate and response handlers in `chat-backend/src/routes/survey.gate.ts` — replace stubs with service calls; pseudonymousId resolved from authenticated user context

### Extensions (v2) — Gate correctness for invalidation + group context + review step + memory

- [x] T112 [US3] Store `group_id` on response creation/update in `chat-backend/src/services/surveyResponse.service.ts` using the user’s effective active group (must be one of user memberships and one of instance.group_ids) — MTB-430
- [x] T113 [US3] Update gate-check completion logic in `chat-backend/src/services/surveyResponse.service.ts` to treat a response as complete only when `is_complete = true AND invalidated_at IS NULL` — MTB-437
- [x] T114 [US3] If instance has `add_to_memory = true`, asynchronously upsert a canonical survey summary system message into agent memory in `chat-backend/src/services/agentMemory/agentMemory.service.ts` when a response becomes complete — MTB-434

### Chat Frontend Implementation — [MTB-418](https://mentalhelpglobal.atlassian.net/browse/MTB-418)

- [x] T058 [P] [US3] Create survey API client functions (`gateCheck`, `getResponse`, `submitResponse`, `savePartial`) in `chat-frontend/src/services/surveyApi.ts` using `apiFetch`
- [x] T059 [P] [US3] Create survey gate Zustand store in `chat-frontend/src/stores/surveyGateStore.ts` — pending surveys list, current survey index, current answers, loading state, gate-check action, submit action
- [x] T060 [US3] Create `QuestionRenderer` component in `chat-frontend/src/features/survey/components/QuestionRenderer.tsx` — dispatches to type-specific input based on `question.type`
- [x] T061 [P] [US3] Create `FreeTextInput` component in `chat-frontend/src/features/survey/components/FreeTextInput.tsx` — textarea or input with optional validation (regex, minLength, maxLength)
- [x] T062 [P] [US3] Create `SingleChoiceInput` component in `chat-frontend/src/features/survey/components/SingleChoiceInput.tsx` — radio button group from question options
- [x] T063 [P] [US3] Create `MultiChoiceInput` component in `chat-frontend/src/features/survey/components/MultiChoiceInput.tsx` — checkbox group from question options
- [x] T064 [P] [US3] Create `BooleanInput` component in `chat-frontend/src/features/survey/components/BooleanInput.tsx` — yes/no toggle or radio pair
- [x] T065 [US3] Create `SurveyProgress` component in `chat-frontend/src/features/survey/components/SurveyProgress.tsx` — "Question X of N" progress indicator
- [x] T066 [US3] Create `SurveyForm` component in `chat-frontend/src/features/survey/SurveyForm.tsx` — renders current question via QuestionRenderer, Next/Back navigation, Submit on last question; required question validation blocks Next; auto-saves partial answers on Next via PATCH
- [x] T067 [US3] Create `SurveyGate` component in `chat-frontend/src/features/survey/SurveyGate.tsx` — calls gate-check on mount; if pending surveys: render full-screen SurveyForm for first pending survey; on complete: advance to next pending or render children; if no pending: render children (ChatShell)
- [x] T068 [US3] Integrate `SurveyGate` into chat route hierarchy in `chat-frontend/src/App.tsx` — wrap `ChatShell` inside `SurveyGate` under the `ProtectedRoute` for `/chat` and `/chat/:sessionId` routes
- [x] T069 [US3] Add survey gate i18n keys (Next, Back, Submit, question progress, gate title, loading/error states) to `chat-frontend/src/locales/en.json`, `uk.json`, and `ru.json`

- [x] T115 [US3] Add final “Review answers” step to `chat-frontend/src/features/survey/SurveyForm.tsx` allowing jump-back to any question and final submit from review — MTB-435
- [x] T116 [US3] Update `chat-frontend/src/stores/surveyGateStore.ts` to support review mode and jump-to-question navigation (without breaking partial save semantics) — MTB-436

**Checkpoint**: End-to-end flow works: researcher creates and publishes schema → creates instance for a group → officer in that group sees gate → completes survey → chat loads. Partial progress preserved on exit/return.

---

## Phase 6: User Story 4 — Researcher Clones and Iterates on a Schema (Priority: P2)

**Jira Story**: [MTB-409](https://mentalhelpglobal.atlassian.net/browse/MTB-409)

**Goal**: Researchers can clone any schema to create a new independent draft, enabling iterative survey design

**Independent Test**: Clone a published schema, verify new draft is independent (has `clonedFromId`), modify and publish it, confirm original is unchanged

### Implementation — [MTB-420](https://mentalhelpglobal.atlassian.net/browse/MTB-420)

- [x] T070 [US4] Implement `cloneSchema(id, createdBy)` in `chat-backend/src/services/surveySchema.service.ts` — read source schema (any status), create new draft with copied questions (new UUIDs), set `cloned_from_id`, return new schema
- [x] T071 [US4] Wire clone handler in `chat-backend/src/routes/survey.schemas.ts` — `POST /api/workbench/survey-schemas/:id/clone`
- [x] T072 [P] [US4] Add `cloneSchema` API client function to `workbench-frontend/src/services/surveyApi.ts`
- [x] T073 [US4] Add Clone action button to `SurveySchemaListView` and `SurveySchemaEditorView` (visible on published/archived schemas) in `workbench-frontend/src/features/workbench/surveys/` — on click calls clone API and navigates to new draft editor

**Checkpoint**: Researcher can clone any schema, modify the clone independently, and publish without affecting the original or its instances

---

## Phase 7: User Story 5 — Admin Archives and Restores Schemas (Priority: P2)

**Jira Story**: [MTB-410](https://mentalhelpglobal.atlassian.net/browse/MTB-410)

**Goal**: Admins can archive published schemas (hiding from default list) and restore archived schemas to draft

**Independent Test**: Archive a published schema, verify hidden from default list but visible via filter, verify new instances blocked, restore to draft, verify editable

### Implementation — [MTB-421](https://mentalhelpglobal.atlassian.net/browse/MTB-421)

- [x] T074 [US5] Implement `archiveSchema(id)` in `chat-backend/src/services/surveySchema.service.ts` — validate published status, set `status = 'archived'`, set `archived_at = now()`
- [x] T075 [US5] Implement `restoreSchema(id)` in `chat-backend/src/services/surveySchema.service.ts` — validate archived status, set `status = 'draft'`, clear `archived_at`, clear `published_at`
- [x] T076 [US5] Wire archive and restore handlers in `chat-backend/src/routes/survey.schemas.ts` — `POST .../archive` requires `Permission.SURVEY_SCHEMA_ARCHIVE`, `POST .../restore` requires `Permission.SURVEY_SCHEMA_ARCHIVE`
- [x] T077 [P] [US5] Add `archiveSchema` and `restoreSchema` API client functions to `workbench-frontend/src/services/surveyApi.ts`
- [x] T078 [US5] Add Archive/Restore action buttons to `SurveySchemaListView` in `workbench-frontend/src/features/workbench/surveys/SurveySchemaListView.tsx` — Archive visible on published schemas (Admin only), Restore visible on archived schemas (Admin only); add archived filter toggle

**Checkpoint**: Admin can archive published schemas, restored schemas return to draft and are editable, archived schemas block new instance creation

---

## Phase 8: User Story 6 — Supervisor Views Instance Status (Priority: P3)

**Jira Story**: [MTB-411](https://mentalhelpglobal.atlassian.net/browse/MTB-411)

**Goal**: Supervisors can view instance list with group assignments, timing, and completion counts (read-only, no response content)

**Independent Test**: Log in as supervisor, view instance list, verify completion counts visible, verify no access to individual response answers

### Implementation — [MTB-422](https://mentalhelpglobal.atlassian.net/browse/MTB-422)

- [x] T079 [US6] Ensure instance list and detail endpoints in `chat-backend/src/routes/survey.instances.ts` use `requireAnyPermission(Permission.SURVEY_INSTANCE_MANAGE, Permission.SURVEY_INSTANCE_VIEW)` — Supervisor has `SURVEY_INSTANCE_VIEW` only
- [x] T080 [US6] Implement `listResponsesForInstance(instanceId)` in `chat-backend/src/services/surveyResponse.service.ts` — returns individual pseudonymous responses with answers; used by response viewer endpoint
- [x] T081 [US6] Add `GET /api/workbench/survey-instances/:id/responses` endpoint in `chat-backend/src/routes/survey.instances.ts` — requires `Permission.SURVEY_RESPONSE_VIEW` (Researcher/Admin only, not Supervisor)
- [x] T082 [P] [US6] Add `listResponses` API client function to `workbench-frontend/src/services/surveyApi.ts`
- [x] T083 [US6] Create `SurveyResponseListView` component in `workbench-frontend/src/features/workbench/surveys/SurveyResponseListView.tsx` — table of pseudonymous responses with answers; accessible from instance detail; guarded by `Permission.SURVEY_RESPONSE_VIEW`
- [x] T084 [US6] Add response list route `/workbench/surveys/instances/:id/responses` to `workbench-frontend/src/features/workbench/WorkbenchShell.tsx` — `SubRouteGuard` with `Permission.SURVEY_RESPONSE_VIEW`
- [x] T085 [US6] Ensure supervisor can access instance list and detail routes in `workbench-frontend/src/features/workbench/WorkbenchShell.tsx` — update `SubRouteGuard` for instance list/detail to accept `anyPermissions: [Permission.SURVEY_INSTANCE_MANAGE, Permission.SURVEY_INSTANCE_VIEW]`

### Extensions (v2) — Invalidation (instance / group / individual) + memory removal

- [x] T117 [US6] Add backend invalidation service methods in `chat-backend/src/services/surveyResponse.service.ts`: invalidate instance, invalidate group, invalidate response (sets `invalidated_at/by/reason`; does not delete) — MTB-438
- [x] T118 [US6] Add routes in `chat-backend/src/routes/survey.instances.ts` for invalidation endpoints: `POST /:id/invalidate`, `POST /:id/invalidate-group`, and `POST /survey-responses/:id/invalidate` with RBAC guards (Researcher/Admin) — MTB-439
- [x] T119 [US6] Exclude invalidated responses from `completedCount` in instance list/detail queries in `chat-backend/src/services/surveyInstance.service.ts` — MTB-440
- [x] T120 [US6] On invalidation, asynchronously remove corresponding survey-memory system message(s) from agent memory in `chat-backend/src/services/agentMemory/agentMemory.service.ts` (instance-wide, group-scope, individual) — MTB-441
- [x] T121 [US6] Add invalidation API client functions in `workbench-frontend/src/services/surveyApi.ts` and wire into `workbench-frontend/src/stores/surveyStore.ts` — MTB-443
- [x] T122 [US6] Update `workbench-frontend/src/features/workbench/surveys/SurveyResponseListView.tsx` to show invalidation status + allow invalidation actions (instance-wide, group-scope, individual) with reason capture and confirmations — MTB-444
- [x] T123 [US6] Update instance detail UI `workbench-frontend/src/features/workbench/surveys/SurveyInstanceDetailView.tsx` to link to response list and expose invalidation controls/entry points — MTB-442

**Checkpoint**: Supervisor sees instance metadata and counts. Researcher/Admin can view individual pseudonymous responses. Supervisor gets 403 on response detail endpoint.

---

## Phase 9: Schema Delete Protection — [MTB-423](https://mentalhelpglobal.atlassian.net/browse/MTB-423)

**Purpose**: Ensure draft schemas with instances cannot be deleted

- [x] T086 Implement `deleteSchema(id)` in `chat-backend/src/services/surveySchema.service.ts` — validate draft status (403 otherwise), check for existing instances (409 if any), DELETE from `survey_schemas`
- [x] T087 Wire delete handler in `chat-backend/src/routes/survey.schemas.ts` — `DELETE /api/workbench/survey-schemas/:id`
- [x] T088 Add Delete action button to `SurveySchemaListView` in `workbench-frontend/src/features/workbench/surveys/SurveySchemaListView.tsx` — visible on draft schemas only; confirmation dialog; show 409 error message if instances exist

**Checkpoint**: Draft schemas without instances can be deleted; draft schemas with instances return 409

---

## Phase 10: Polish & Cross-Cutting Concerns — [MTB-424](https://mentalhelpglobal.atlassian.net/browse/MTB-424)

**Purpose**: Responsive design, i18n completion, smoke tests, documentation, PR cycle

- [x] T089 [P] Validate survey gate responsive behavior in `chat-frontend/` — full-width on mobile, single question per screen, bottom navigation; test on Chrome (Android) and Safari (iOS) breakpoints
- [x] T090 [P] Validate workbench survey pages responsive behavior in `workbench-frontend/` — schema list and instance list collapse to card layout on tablet; editor usable on tablet with touch drag
- [x] T091 [P] Verify PWA behavior unchanged in both `chat-frontend/` and `workbench-frontend/` — install flow, offline manifest, service worker cache
- [x] T092 Run quickstart.md validation — follow all setup steps end-to-end in a clean environment; verify migration, routes, gate flow
- [x] T093 [P] Capture screenshots via Playwright MCP against dev environment for: schema list, schema editor (draft + published), instance list, instance create form, survey gate (question rendering), gate completion
- [x] T094 [P] Update Confluence User Manual with survey module pages — schema authoring (workbench), instance deployment (workbench), survey gate (user-facing), using Playwright-captured screenshots
- [x] T095 [P] Update Confluence Release Notes with survey module entry (version, date, capabilities, known limitations: conditional logic deferred, scoring deferred)
- [x] T096 [P] Update Confluence Non-Technical Onboarding with survey workflow overview — how researchers create/deploy surveys, how officers experience the gate
- [x] T097 Add completion summary comment to Jira Epic with evidence references and outcome (when Epic is created)
- [x] T098 Verify pre-release readiness: deploy workflows exist in `chat-backend`, `workbench-frontend`, `chat-frontend`; prod GitHub environments have all required secrets/variables; health endpoints available
- [x] T099 Open PR(s) from `018-workbench-survey` branch to `develop` in all affected repos (`chat-types`, `chat-backend`, `workbench-frontend`, `chat-frontend`, `chat-ui`), obtain required reviews, and merge only after all required checks pass
- [x] T100 Verify unit and UI/E2E test gates passed for merged PR(s)
- [x] T101 Capture post-deploy smoke evidence: `GET /api/workbench/survey-schemas` → 200, `GET /api/workbench/survey-instances` → 200, `GET /api/chat/gate-check` → 200 (empty), `/chat` route loads normally

- [x] T124 Validate invalidation flows in dev: instance-wide, group-scope, and individual invalidation re-open gate and exclude counts; verify memory removal/upsert behavior when `add_to_memory` enabled — MTB-445
- [x] T102 Delete merged remote `018-workbench-survey` branches and purge local branches in all affected repos
- [x] T103 Sync local `develop` to `origin/develop` in each affected repository

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (chat-types published) — BLOCKS all user stories
- **US1 Schema Authoring (Phase 3)**: Depends on Phase 2 — first vertical slice
- **US2 Instance Deployment (Phase 4)**: Depends on Phase 3 (needs published schemas to create instances from)
- **US3 Survey Gate (Phase 5)**: Depends on Phase 4 (needs active instances to gate against)
- **US4 Clone (Phase 6)**: Depends on Phase 3 only (clones schemas; independent of instances/gate)
- **US5 Archive/Restore (Phase 7)**: Depends on Phase 3 only (operates on published schemas)
- **US6 Supervisor View (Phase 8)**: Depends on Phase 4 (needs instances to view)
- **Schema Delete (Phase 9)**: Depends on Phase 3 (operates on draft schemas)
- **Polish (Phase 10)**: Depends on all desired story phases being complete

**v2 extensions**:
- Phase 2 (T104–T106) must land before v2 backend/frontend work (adds DB + types for invalidation/memory/group context)
- US3 extensions (T112–T116) depend on Phase 2 extensions (response group_id + invalidation fields) and US2 extension T107 (instance addToMemory)
- US6 invalidation extensions (T117–T123) depend on Phase 2 extensions and existing response list endpoint/UI

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundation)
                        │
                        ├──► Phase 3 (US1: Schema) ──► Phase 4 (US2: Instance) ──► Phase 5 (US3: Gate)
                        │         │                          │
                        │         ├──► Phase 6 (US4: Clone)  ├──► Phase 8 (US6: Supervisor)
                        │         ├──► Phase 7 (US5: Archive)
                        │         └──► Phase 9 (Delete)
                        │
                        └──► Phase 10 (Polish) — after all stories
```

### Within Each User Story

- Backend services before route handlers
- Route handlers before frontend API clients
- Frontend API clients before UI components
- UI components before route registration
- i18n keys alongside UI components

### Cross-Repository Execution Order

1. `chat-types` (Phase 1) — FIRST
2. `chat-backend` (Phases 2–9 backend tasks) — SECOND
3. `workbench-frontend` + `chat-frontend` (Phases 3–9 frontend tasks) — PARALLEL after backend APIs available
4. `chat-ui` (Phase 10 E2E) — LAST

### Parallel Opportunities

- T007, T008, T009 — dependency updates across repos
- T012, T013, T014 — service stubs (different files)
- T015, T016, T017 — route skeletons (different files)
- T025, T026 — API client + Zustand store (different files)
- T045, T046 — instance API client + store update (different files)
- T058, T059 — gate API client + store (different files)
- T061, T062, T063, T064 — question input components (all independent files)
- T072, T077, T082 — API client additions (across phases, same file but non-conflicting)
- T089, T090, T091 — responsive/PWA validation (independent apps)
- T093, T094, T095, T096 — documentation tasks (independent pages)

---

## Parallel Example: User Story 3 (Phase 5)

```
# Backend (sequential):
T053 → T054 → T055 → T056 → T057

# Frontend (parallel after API client):
T058 + T059 (parallel: API client + store)
    ↓
T061 + T062 + T063 + T064 (parallel: all input components)
    ↓
T060 → T065 → T066 → T067 → T068
    ↓
T069 (i18n)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Complete Phase 1: Setup (types + permissions)
2. Complete Phase 2: Foundation (migration + stubs)
3. Complete Phase 3: US1 — Schema authoring
4. Complete Phase 4: US2 — Instance deployment
5. Complete Phase 5: US3 — Survey gate
6. **STOP and VALIDATE**: End-to-end flow works (create → publish → deploy → gate → complete → chat)

### Incremental Delivery

1. Setup + Foundation → infrastructure ready
2. US1 (Schema) → researcher can author surveys → Demo
3. US2 (Instance) → researcher can deploy surveys → Demo
4. US3 (Gate) → officers blocked and complete surveys → **MVP Complete**
5. US4 (Clone) → iterate on published surveys
6. US5 (Archive) → lifecycle management
7. US6 (Supervisor) → oversight visibility
8. Delete protection → safety net
9. Polish → production readiness

---

## Summary

| Metric | Value |
|---|---|
| **Total tasks** | 124 |
| **Phase 1 (Setup)** | 9 tasks |
| **Phase 2 (Foundation)** | 12 tasks |
| **Phase 3 (US1 Schema)** | 19 tasks |
| **Phase 4 (US2 Instance)** | 20 tasks |
| **Phase 5 (US3 Gate)** | 22 tasks |
| **Phase 6 (US4 Clone)** | 4 tasks |
| **Phase 7 (US5 Archive)** | 5 tasks |
| **Phase 8 (US6 Supervisor)** | 14 tasks |
| **Phase 9 (Delete)** | 3 tasks |
| **Phase 10 (Polish)** | 16 tasks |
| **Parallel opportunities** | 10 groups identified |
| **MVP scope** | Phases 1–5 (US1 + US2 + US3): 82 tasks |

---

## Notes

- **Jira transitions**: Each Jira Task MUST be transitioned to Done immediately when the corresponding task is marked `[X]` — do NOT batch transitions at the end. Stories are transitioned when all their tasks are complete.
- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Never merge directly into `develop`; use reviewed PRs from feature/bugfix branches only
- After merge, delete remote/local feature branches and sync local `develop`
