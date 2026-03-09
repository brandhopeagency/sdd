# Tasks: Survey Schema Tools — Autosave, Preview & Export/Import

**Input**: Design documents from `specs/021-survey-schema-tools/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/schema-import-api.md

**Tests**: Not explicitly requested — test tasks omitted (E2E covered in Polish phase).

**Organization**: Tasks grouped by user story. US1 (Autosave) can start immediately after Setup; US2 (Preview) requires Foundational phase (component extraction); US3/US4 (Export/Import) can start after Setup.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature branches and add shared types needed by all stories

- [x] T001 Create feature branch `021-survey-schema-tools` from `develop` in all 6 affected repositories: `chat-types`, `chat-frontend-common`, `chat-frontend`, `chat-backend`, `workbench-frontend`, `chat-ui`
- [x] T002 Add `SchemaExportFormat` and `ExportQuestion` interfaces to `chat-types/src/survey.ts` per data-model.md mapping rules
- [x] T003 Export new types from `chat-types/src/index.ts` barrel and bump package version

---

## Phase 2: Foundational (Component Extraction)

**Purpose**: Extract survey UI components from `chat-frontend` to `chat-frontend-common` so both the gate and the preview modal use identical rendering. BLOCKS User Story 2 (Preview).

**⚠️ CRITICAL**: US2 (Preview) cannot begin until this phase is complete. US1 (Autosave), US3 (Export), and US4 (Import) do NOT depend on this phase and can proceed in parallel.

- [x] T004 Create `chat-frontend-common/src/survey-ui/` directory structure with barrel export in `chat-frontend-common/src/survey-ui/index.ts`
- [x] T005 [P] Move `QuestionRenderer.tsx` from `chat-frontend/src/features/survey/components/QuestionRenderer.tsx` to `chat-frontend-common/src/survey-ui/QuestionRenderer.tsx`
- [x] T006 [P] Move `SurveyProgress.tsx` from `chat-frontend/src/features/survey/components/SurveyProgress.tsx` to `chat-frontend-common/src/survey-ui/SurveyProgress.tsx`
- [x] T007 [P] Move `FreeTextInput.tsx` from `chat-frontend/src/features/survey/components/FreeTextInput.tsx` to `chat-frontend-common/src/survey-ui/FreeTextInput.tsx`
- [x] T008 [P] Move `SingleChoiceInput.tsx` from `chat-frontend/src/features/survey/components/SingleChoiceInput.tsx` to `chat-frontend-common/src/survey-ui/SingleChoiceInput.tsx`
- [x] T009 [P] Move `MultiChoiceInput.tsx` from `chat-frontend/src/features/survey/components/MultiChoiceInput.tsx` to `chat-frontend-common/src/survey-ui/MultiChoiceInput.tsx`
- [x] T010 [P] Move `BooleanInput.tsx` from `chat-frontend/src/features/survey/components/BooleanInput.tsx` to `chat-frontend-common/src/survey-ui/BooleanInput.tsx`
- [x] T011 [P] Move `NumericInput.tsx` from `chat-frontend/src/features/survey/components/NumericInput.tsx` to `chat-frontend-common/src/survey-ui/NumericInput.tsx`
- [x] T012 [P] Move `DateTimeInput.tsx` from `chat-frontend/src/features/survey/components/DateTimeInput.tsx` to `chat-frontend-common/src/survey-ui/DateTimeInput.tsx`
- [x] T013 [P] Move `PresetTextInput.tsx` from `chat-frontend/src/features/survey/components/PresetTextInput.tsx` to `chat-frontend-common/src/survey-ui/PresetTextInput.tsx`
- [x] T014 [P] Move `RatingScaleInput.tsx` from `chat-frontend/src/features/survey/components/RatingScaleInput.tsx` to `chat-frontend-common/src/survey-ui/RatingScaleInput.tsx`
- [x] T015 Move `SurveyForm.tsx` from `chat-frontend/src/features/survey/SurveyForm.tsx` to `chat-frontend-common/src/survey-ui/SurveyForm.tsx` and add a `mode: 'gate' | 'preview'` prop — in preview mode, skip API calls for partial saves and gate-check (depends on T005–T014)
- [x] T016 Update `chat-frontend-common/src/survey-ui/index.ts` barrel to export all moved components and bump `chat-frontend-common` package version
- [x] T017 Update `chat-frontend/src/features/survey/SurveyGate.tsx` to import `SurveyForm`, `QuestionRenderer`, `SurveyProgress`, and all input components from `@mentalhelpglobal/chat-frontend-common/survey-ui` instead of local paths
- [x] T018 Remove original component files from `chat-frontend/src/features/survey/components/` and `chat-frontend/src/features/survey/SurveyForm.tsx` after import migration is confirmed working
- [x] T019 Run `chat-frontend` unit tests to verify survey gate renders correctly with no functional changes after component extraction

**Checkpoint**: Component extraction complete. The survey gate in `chat-frontend` uses shared components from `chat-frontend-common`. No user-visible behavior change.

---

## Phase 3: User Story 1 — Schema Autosave on Edit (Priority: P1) 🎯 MVP

**Goal**: Draft schemas autosave every 2 seconds after the last edit. Visual status indicator shows save state. Conflict notification for concurrent editors.

**Independent Test**: Open a draft schema, add a question, wait for "Saved" indicator, close tab, reopen — the question is present.

### Implementation for User Story 1

- [x] T020 [P] [US1] Create `useDebouncedSave` hook in `workbench-frontend/src/features/workbench/surveys/hooks/useDebouncedSave.ts` — accepts schema state and ID, debounces at 2 seconds, calls existing `surveySchemaApi.update()`, tracks `SaveStatus` enum (`idle | saving | saved | error`), cancels in-flight request on new trigger, compares `updatedAt` on response for conflict detection — MTB-588
- [x] T021 [P] [US1] Create `SaveStatusIndicator` component in `workbench-frontend/src/features/workbench/surveys/components/SaveStatusIndicator.tsx` — renders "Saving...", "Saved [time]", or "Save failed — Retry" based on `SaveStatus`; keyboard-accessible retry button — MTB-589
- [x] T022 [P] [US1] Create `ConflictNotification` component in `workbench-frontend/src/features/workbench/surveys/components/ConflictNotification.tsx` — renders notification when `updatedAt` mismatch detected; offers "Reload" and "Continue editing" actions — MTB-590
- [x] T023 [US1] Integrate `useDebouncedSave` hook into `workbench-frontend/src/features/workbench/surveys/SurveySchemaEditorView.tsx` — replace manual save button with autosave for draft schemas; add `SaveStatusIndicator` to editor header; add `ConflictNotification` overlay (depends on T020, T021, T022) — MTB-591
- [x] T024 [US1] Add `beforeunload` event listener in `workbench-frontend/src/features/workbench/surveys/SurveySchemaEditorView.tsx` — warn when `SaveStatus` is `saving` or there are unmutated local changes since last save — MTB-592
- [x] T025 [US1] Ensure autosave is disabled when schema status is `published` or `archived` in `workbench-frontend/src/features/workbench/surveys/SurveySchemaEditorView.tsx` — `useDebouncedSave` hook skips save when `isReadOnly` is true — MTB-593

**Checkpoint**: Autosave fully functional. Draft schemas save automatically. Published/archived schemas remain read-only. Conflict notification works.

---

## Phase 4: User Story 2 — Survey Preview/Simulation (Priority: P1)

**Goal**: Researchers can preview any schema (draft/published/archived) as a modal overlay showing gate-style question-by-question flow with typed inputs, conditional visibility, progress, and review step. No data persisted.

**Independent Test**: Open a draft schema with conditional questions, click Preview, walk through questions, verify conditions work, reach review step, exit — no data created.

### Implementation for User Story 2

- [x] T026 [US2] Create `SurveyPreviewModal` component in `workbench-frontend/src/features/workbench/surveys/components/SurveyPreviewModal.tsx` — renders a centered modal overlay using `SurveyForm` from `@mentalhelpglobal/chat-frontend-common/survey-ui` with `mode='preview'`; manages local ephemeral state for answers; includes "Exit Preview" button; responsive across viewports (depends on Phase 2 completion) — MTB-594
- [x] T027 [US2] Add "Preview" button to `workbench-frontend/src/features/workbench/surveys/SurveySchemaEditorView.tsx` — opens `SurveyPreviewModal`; disabled with tooltip when schema has zero questions; available for all schema statuses (draft/published/archived) — MTB-595
- [x] T028 [US2] Ensure `SurveyPreviewModal` evaluates visibility conditions in real-time via `evaluateVisibility` from `@mentalhelpglobal/chat-types` — conditional questions appear/hide as sample answers are entered; progress indicator adjusts total to visible questions only — MTB-596
- [x] T029 [US2] Ensure `SurveyPreviewModal` renders the review step at the end of the question sequence in `workbench-frontend/src/features/workbench/surveys/components/SurveyPreviewModal.tsx` — shows all answered questions for review before a simulated "Submit" that simply closes the modal — MTB-597

**Checkpoint**: Preview fully functional. All question types render correctly. Conditional logic works in real-time. Review step shown. No data persisted.

---

## Phase 5: User Story 3 — Export Survey Schema to JSON (Priority: P2)

**Goal**: Researchers can export any schema as a downloadable JSON file containing the portable schema definition with `schemaVersion`, preserved question IDs, and no server-internal fields.

**Independent Test**: Open a published schema with multiple question types and conditions, click Export, verify JSON file downloaded with correct content and filename.

### Implementation for User Story 3

- [x] T030 [P] [US3] Create `schemaExporter.ts` utility in `workbench-frontend/src/features/workbench/surveys/utils/schemaExporter.ts` — maps `SurveySchema` to `SchemaExportFormat` (strips server-internal fields per FR-017, preserves question IDs per FR-015, sets `schemaVersion: 1`); generates filename slug per FR-018 pattern; triggers browser download via `Blob` + `URL.createObjectURL` — MTB-598
- [x] T031 [P] [US3] Create `SchemaExportButton` component in `workbench-frontend/src/features/workbench/surveys/components/SchemaExportButton.tsx` — button that calls `schemaExporter` with the current schema; available for all schema statuses; keyboard-accessible — MTB-599
- [x] T032 [US3] Add `SchemaExportButton` to `workbench-frontend/src/features/workbench/surveys/SurveySchemaEditorView.tsx` editor toolbar (depends on T030, T031) — MTB-600

**Checkpoint**: Export fully functional. JSON file downloads with correct content, filename, and format.

---

## Phase 6: User Story 4 — Import Survey Schema from JSON (Priority: P2)

**Goal**: Researchers can import a JSON file to create a new draft schema. Client-side pre-validation for fast feedback; server-side authoritative validation via dedicated import endpoint.

**Independent Test**: Export a schema, import the JSON file, verify a new draft is created with matching questions, types, conditions, and configuration.

### Implementation for User Story 4

- [x] T033 [P] [US4] Add `importSchema()` method to `chat-backend/src/services/surveySchema.service.ts` — accepts parsed `SchemaExportFormat` body; validates `schemaVersion` (≤ current supported version); reuses `validateQuestionInput` and `validateVisibilityConditions`; creates new draft schema with new UUID, `createdBy` from auth context, preserved question IDs; returns created schema or 422 with detailed error array per contracts/schema-import-api.md — MTB-601
- [x] T034 [P] [US4] Add `POST /api/workbench/survey-schemas/import` route to `chat-backend/src/routes/survey.schemas.ts` — calls `importSchema()` service method; RBAC: Researcher, Admin, Supervisor; returns 201 on success, 422 on validation failure with detailed errors — MTB-602
- [x] T035 [P] [US4] Create `schemaImporter.ts` utility in `workbench-frontend/src/features/workbench/surveys/utils/schemaImporter.ts` — client-side pre-validation (file size ≤ 5 MB per FR-025, JSON parse, `schemaVersion` presence, `title` and `questions` array presence); calls `POST /import` endpoint; returns created schema or error details — MTB-603
- [x] T036 [US4] Create `SchemaImportDialog` component in `workbench-frontend/src/features/workbench/surveys/components/SchemaImportDialog.tsx` — file picker with drag-and-drop; shows inline validation errors from client-side and server-side checks; on success navigates to new draft schema in editor; rejects non-JSON files per FR-026 (depends on T035) — MTB-604
- [x] T037 [US4] Add "Import" button to `workbench-frontend/src/features/workbench/surveys/SurveySchemaListView.tsx` — opens `SchemaImportDialog`; available to Researcher, Admin, and Supervisor roles (depends on T036) — MTB-605

**Checkpoint**: Import fully functional. Valid JSON creates a new draft. Invalid files show clear errors. Round-trip export→import preserves all schema data.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: E2E tests, documentation, PR workflow, and deployment

- [x] T038 [P] Create E2E autosave tests in `chat-ui/tests/survey-schema-tools/autosave.spec.ts` — test save indicator states, tab close warning, conflict notification, read-only mode skip
- [x] T039 [P] Create E2E preview tests in `chat-ui/tests/survey-schema-tools/preview.spec.ts` — test modal open/close, question navigation, conditional visibility, typed inputs, review step, zero-question disable
- [x] T040 [P] Create E2E export/import tests in `chat-ui/tests/survey-schema-tools/export-import.spec.ts` — test export download, import upload, round-trip fidelity, validation errors, version check
- [x] T041 [P] Validate responsive behavior of preview modal across desktop (1280px+) and mobile (375px) viewports in `chat-ui/tests/survey-schema-tools/preview.spec.ts`
- [x] T042a [P] Register i18n keys for all new user-visible strings (save status labels, button labels, validation errors, tooltips, conflict notification) in `workbench-frontend` translation files (uk, en, ru) per FR-029
- [x] T042 Run `specs/021-survey-schema-tools/quickstart.md` verification checklist across all affected repositories
- [ ] T043 [P] Capture screenshots via Playwright MCP against dev environment for autosave indicator, preview modal, export button, and import dialog
- [ ] T044 [P] Update Confluence User Manual with survey schema editor section covering autosave behavior, preview usage, and export/import workflow with Playwright-captured screenshots
- [ ] T045 [P] Update Confluence Release Notes with production release entry (version, date, user-visible changes) — ONLY when promoting to production via tagged `main` commit; skip when merging to `develop`
- [ ] T046 Verify pre-release readiness: deploy workflows exist in `chat-types`, `chat-frontend-common`, `chat-frontend`, `chat-backend`, `workbench-frontend`; prod GitHub environments have all required secrets and variables
- [ ] T047 Open PRs from `021-survey-schema-tools` branch to `develop` in all 6 affected repositories, obtain required reviews, and merge only after all required checks pass
- [ ] T048 Verify unit and E2E test gates passed for merged PRs
- [ ] T049 Capture post-deploy smoke evidence: PATCH schema endpoint, POST import endpoint, workbench survey editor loads, preview modal opens
- [ ] T050 Delete merged remote `021-survey-schema-tools` branches in all 6 repositories and purge local feature branches
- [ ] T051 Sync local `develop` to `origin/develop` in all 6 affected repositories
- [ ] T052 Add completion summary comment to Jira Epic MTB-583 with evidence references and outcome

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T003) — BLOCKS US2 (Preview) only
- **US1 Autosave (Phase 3)**: Depends on Phase 1 only — can start in parallel with Phase 2
- **US2 Preview (Phase 4)**: Depends on Phase 2 completion (shared components required)
- **US3 Export (Phase 5)**: Depends on Phase 1 only — can start in parallel with Phase 2 and US1
- **US4 Import (Phase 6)**: Depends on Phase 1 only — backend tasks (T033, T034) independent; frontend tasks depend on backend
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Autosave)**: Independent — no dependency on other stories
- **US2 (Preview)**: Depends on Phase 2 component extraction — no dependency on other stories
- **US3 (Export)**: Independent — no dependency on other stories
- **US4 (Import)**: Independent — backend and frontend tasks can proceed in parallel

### Cross-Repository Execution Order

```
1. chat-types (T002–T003)
2. chat-frontend-common (T004–T016) ─┐
3. chat-frontend (T017–T019) ────────┤── Phase 2 (blocks US2)
4. chat-backend (T033–T034) ─────────┤── US4 backend (parallel with Phase 2)
5. workbench-frontend (T020–T037) ───┘── US1, US2, US3, US4 frontend
6. chat-ui (T038–T041) ── E2E tests (last)
```

### Parallel Opportunities

- **After Phase 1**: US1 (T020–T025) and Phase 2 (T004–T019) can proceed in parallel
- **After Phase 1**: US3 (T030–T032) can proceed in parallel with everything
- **After Phase 1**: US4 backend (T033–T034) can proceed in parallel with everything
- **Within Phase 2**: All component moves (T005–T014) are parallelizable
- **Within US1**: Hook, indicator, and notification (T020–T022) are parallelizable
- **Within US4**: Backend (T033–T034) and frontend utility (T035) are parallelizable

---

## Parallel Example: After Phase 1

```
# These can all run simultaneously after Phase 1 completes:

# Stream A: Component extraction (Phase 2)
T004 → T005–T014 (parallel) → T015 → T016 → T017 → T018 → T019

# Stream B: Autosave (US1)
T020 + T021 + T022 (parallel) → T023 → T024 → T025

# Stream C: Export (US3)
T030 + T031 (parallel) → T032

# Stream D: Import backend (US4 partial)
T033 + T034 (parallel)
```

---

## Implementation Strategy

### MVP First (US1 — Autosave Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 3: US1 (Autosave) — 6 tasks, workbench-frontend only
3. **STOP and VALIDATE**: Edit a draft schema, verify autosave works, close/reopen
4. Deploy to dev

### Incremental Delivery

1. Setup → US1 (Autosave) → **MVP deployed** (highest user value immediately)
2. Phase 2 (component extraction) → US2 (Preview) → **Preview available**
3. US3 (Export) → **Portability: backup/share**
4. US4 (Import) → **Full round-trip portability**
5. Polish → PRs → Production

### Single Developer (Sequential)

Phase 1 → US1 → Phase 2 → US2 → US3 → US4 → Phase 7

---

## Notes

- **Jira transitions**: Each Jira Task MUST be transitioned to Done immediately when the corresponding task is marked `[X]` — do NOT batch transitions at the end. Stories are transitioned when all their tasks are complete.
- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Never merge directly into `develop`; use reviewed PRs from feature/bugfix branches only
- After merge, delete remote/local feature branches and sync local `develop`
