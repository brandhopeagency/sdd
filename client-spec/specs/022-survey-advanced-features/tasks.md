# Tasks: Survey Advanced Features

**Input**: Design documents from `/specs/022-survey-advanced-features/`
**Jira Epic**: [MTB-606](https://mentalhelpglobal.atlassian.net/browse/MTB-606)
**Branch**: `022-survey-advanced-features`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup (Branch Creation)
**Jira**: [MTB-607](https://mentalhelpglobal.atlassian.net/browse/MTB-607)

**Purpose**: Create feature branch in all 5 affected repositories with the same branch name.

- [x] T001 [P] Create branch `022-survey-advanced-features` from `develop` in `chat-types` repo (D:\src\MHG\chat-types)
- [x] T002 [P] Create branch `022-survey-advanced-features` from `develop` in `chat-backend` repo (D:\src\MHG\chat-backend)
- [x] T003 [P] Create branch `022-survey-advanced-features` from `develop` in `workbench-frontend` repo (D:\src\MHG\workbench-frontend)
- [x] T004 [P] Create branch `022-survey-advanced-features` from `develop` in `chat-frontend-common` repo (D:\src\MHG\chat-frontend-common)
- [x] T005 [P] Create branch `022-survey-advanced-features` from `develop` in `chat-frontend` repo (D:\src\MHG\chat-frontend)
- [x] T006 [P] Record Jira Epic key MTB-606 in the header of `specs/022-survey-advanced-features/spec.md`

**Checkpoint**: All branches ready. Phases 2–8 can begin.

---

## Phase 2: Foundational (chat-types Type Changes)
**Jira**: [MTB-607](https://mentalhelpglobal.atlassian.net/browse/MTB-607)

**Purpose**: Publish updated shared types to unblock all downstream repository work. All Phase 3–7 tasks across `chat-backend`, `workbench-frontend`, `chat-frontend-common`, and `chat-frontend` depend on this phase.

**⚠️ CRITICAL**: No user story implementation work in other repos can begin until T009 (chat-types build) is complete.

- [x] T007 Add new type definitions to `chat-types/src/survey.ts`: `ChoiceOptionConfig` interface; `NOT_IN` entry in `VisibilityConditionOperator`; `visibilityConditions?: VisibilityCondition[] | null` and `visibilityConditionCombinator?: 'and' | 'or' | null` on `SurveyQuestion` and `SurveyQuestionInput`; `optionConfigs?: ChoiceOptionConfig[] | null` on `SurveyQuestion` and `SurveyQuestionInput`; `freetextValues?: Record<string, string> | null` on `SurveyAnswer`; update `ExportQuestion` with new fields and bump `CURRENT_SCHEMA_EXPORT_VERSION` to `2` in `chat-types/src/survey.ts`
- [x] T008 Update `evaluateVisibility` and `evaluateCondition` in `chat-types/src/survey.ts`: if `visibilityConditions` is present and non-empty, evaluate each condition and combine with combinator (`and` = all true, `or` = at least one true); hidden source question makes its condition false; if `visibilityConditions` absent, fall back to legacy `visibilityCondition`; add `NOT_IN` case (returns true when answer is not in expected array)
- [x] T009 Bump `chat-types/package.json` minor version (e.g. 1.10.0 → 1.11.0) and run `npm run build` to produce updated dist output in `chat-types/`

**Checkpoint**: `chat-types` build complete. All downstream repos can now be updated in parallel.

---

## Phase 3: User Story 1 — Invisible Questions Are Never Required (Priority: P1)
**Jira**: [MTB-608](https://mentalhelpglobal.atlassian.net/browse/MTB-608)

**Goal**: Formally document and test the invariant that hidden questions are never required, preventing future regressions.

**Independent Test**: Run `npm run test` in `chat-types`, `chat-backend`, and `chat-frontend` — all three new test cases must pass.

> **Note**: No new feature code is needed. The invariant is already implemented. These tasks add explicit test coverage.

- [x] T010 [P] [US1] Add Vitest unit test to `chat-types/src/survey.test.ts` asserting `evaluateVisibility` returns `false` for a question with an unmet `visibilityCondition` and that a required flag on that question does not affect the returned visibility
- [x] T011 [P] [US1] Add Vitest unit test to `chat-backend/src/services/surveyResponse.service.test.ts` asserting that submitting a complete survey response where a question marked `required: true` has its visibility condition unmet results in HTTP 200 (not 422)
- [x] T012 [P] [US1] Add Vitest unit test to `chat-frontend/src/stores/surveyGateStore.test.ts` (or equivalent test file) asserting that `visibleQuestions` excludes a question whose visibility condition is not met, and that the survey can advance past it without a required-field error

**Checkpoint**: US1 complete. Three tests pass in three repos. Regression guard in place.

---

## Phase 4: User Story 2 — Researcher Sees All Spaces in Chat Review Filter (Priority: P2)
**Jira**: [MTB-609](https://mentalhelpglobal.atlassian.net/browse/MTB-609)

**Goal**: Replace `user.memberships` data source in the review queue scope selector with `groups.list()` API so all accessible spaces appear.

**Independent Test**: Log in to dev workbench as a researcher. Open Review Queue. Confirm the space filter dropdown lists all spaces returned by `GET /api/admin/groups`, not just the researcher's own memberships.

- [x] T013 [P] [US2] In `workbench-frontend/src/features/workbench/review/ReviewQueueView.tsx`, add `allGroups` state (`GroupDto[]`), `groupsLoading` boolean, and `useEffect` on mount to call `adminApi.groups.list()` and populate `allGroups`
- [x] T014 [P] [US2] In `workbench-frontend/src/features/workbench/review/ReviewQueueView.tsx`, replace `activeMemberships.map(...)` options with `allGroups.map(m => <option key={m.id} value={m.id}>{m.name}</option>)` in the scope `<select>`; show a disabled placeholder option while `groupsLoading` is true; add i18n key `review.queue.scope.loadingSpaces` to `workbench-frontend/src/locales/en.json`, `uk.json`, and `ru.json`

**Checkpoint**: US2 complete. Spaces filter lists all groups. Researcher sees full review coverage.

---

## Phase 5: User Story 3 — Multiple Visibility Conditions with AND/OR (Priority: P3)
**Jira**: [MTB-610](https://mentalhelpglobal.atlassian.net/browse/MTB-610)

**Goal**: Allow schema designers to add multiple visibility conditions per question with a flat AND/OR combinator. Conditions are saved, reloaded, and evaluated correctly.

**Independent Test**: In schema editor, add a 3-question schema where Q3 has two visibility conditions (Q1 = "Yes" AND Q2 = "Option A"). Verify Q3 appears only when both conditions are met. Save, reload — conditions persist. Preview confirms the behavior.

### Backend (chat-backend) — can start after T009

- [x] T015 [US3] Update `buildQuestion` in `chat-backend/src/services/surveySchema.service.ts` to copy `visibilityConditions` and `visibilityConditionCombinator` from the `SurveyQuestionInput` into the built `SurveyQuestion` (alongside the existing `visibilityCondition` copy for backward compat)
- [x] T016 [US3] Update `validateQuestionInput` in `chat-backend/src/services/surveySchema.service.ts` to validate `visibilityConditions[]`: each entry must be a valid `VisibilityCondition` with a recognized operator; each `questionId` must reference a question with a lower `order` (no forward references); `visibilityConditionCombinator` must be `'and'` or `'or'` when `visibilityConditions` is non-empty

### Workbench Frontend (workbench-frontend) — can start after T009, parallel with T015-T016

- [x] T017 [US3] Redesign `workbench-frontend/src/features/workbench/surveys/components/VisibilityConditionEditor.tsx` to manage a list of conditions: render one condition row per entry (question select + operator select + value input + remove button); show an AND/OR combinator toggle when ≥2 conditions exist; provide an "+ Add condition" button; preserve single-condition backward compat when `visibilityConditions` is absent (fall back to displaying the legacy `visibilityCondition`)
- [x] T018 [US3] Update `workbench-frontend/src/features/workbench/surveys/components/QuestionEditor.tsx` to pass `visibilityConditions` and `visibilityConditionCombinator` to and from `VisibilityConditionEditor` instead of the single `visibilityCondition` field
- [x] T019 [US3] Update `toEditorQuestions` in `workbench-frontend/src/features/workbench/surveys/components/QuestionList.tsx` to include `visibilityConditions` and `visibilityConditionCombinator` in the mapped editor question shape
- [x] T020 [US3] Update the `currentSchema` → local state mapping in `workbench-frontend/src/features/workbench/surveys/SurveySchemaEditorView.tsx` to include `visibilityConditions` and `visibilityConditionCombinator` in the `questions` state entries
- [x] T021 [P] [US3] Add i18n keys for multi-condition editor to `workbench-frontend/src/locales/en.json`, `uk.json`, and `ru.json`: `survey.condition.addCondition`, `survey.condition.combinator.and`, `survey.condition.combinator.or`, `survey.condition.removeCondition`
- [x] T040 [US3] In `workbench-frontend/src/features/workbench/surveys/components/VisibilityConditionEditor.tsx`, when loading or rendering conditions, filter out any condition entries whose `questionId` is not found in the current question list; show an inline warning ("Condition references a deleted question — removed") when a stale entry is detected and auto-remove it from the list

**Checkpoint**: US3 complete. Multi-condition visibility works end-to-end from editor to gate flow. Stale condition references are gracefully handled.

---

## Phase 6: User Story 4 — Multi-value Comparison in Conditions (Priority: P4)
**Jira**: [MTB-611](https://mentalhelpglobal.atlassian.net/browse/MTB-611)

**Goal**: Enable the "is one of" / "is not one of" operators in visibility conditions with a tag-style multi-value input, allowing designers to match against a set of values in a single condition.

**Independent Test**: In schema editor, configure a condition with operator `in` and values `["Anxious", "Depressed"]`. In preview, select "Anxious" → conditional question appears. Select "Calm" → hidden. Save and reload — values persist.

> **Depends on**: T017 (US3 VisibilityConditionEditor) must be complete before T023.

### Backend (chat-backend) — can start after T009

- [x] T022 [US4] Update `validateQuestionInput` in `chat-backend/src/services/surveySchema.service.ts` to accept `not_in` as a valid `VisibilityConditionOperator` value (alongside existing `in`, `equals`, `not_equals`, `contains`)

### Workbench Frontend (workbench-frontend) — depends on T017

- [x] T023 [US4] Update `workbench-frontend/src/features/workbench/surveys/components/VisibilityConditionEditor.tsx`: add `not_in` option to the operator dropdown; for `in` and `not_in` operators replace the single text input with a tag-style multi-value input (chip display with individual remove buttons and an "Add value" text field + Enter/comma to confirm)
- [x] T024 [P] [US4] Add i18n keys for multi-value condition editing to `workbench-frontend/src/locales/en.json`, `uk.json`, and `ru.json`: `survey.condition.operator.not_in`, `survey.condition.multiValue.addValue`, `survey.condition.multiValue.placeholder`

**Checkpoint**: US4 complete. `IN`/`NOT_IN` operators work with multi-value input. `evaluateVisibility` (updated in T008) correctly routes respondents.

---

## Phase 7: User Story 5 — Freetext Input Attached to Choice Options (Priority: P5)
**Jira**: [MTB-612](https://mentalhelpglobal.atlassian.net/browse/MTB-612)

**Goal**: Allow designers to mark any option in a single-choice or multi-choice question as having an inline freetext field (string or number type). Respondents see the text input when that option is selected; the entered value is captured and stored alongside the answer.

**Independent Test**: Create a single-choice question with "Other" option marked freetext (string). In preview, select "Other" — a text input appears. Type "custom answer". Complete preview — no errors. In gate flow, verify submitted answer includes `freetextValues: { "Other": "custom answer" }`.

### Backend (chat-backend) — can start after T009

- [x] T025 [US5] Update `buildQuestion` in `chat-backend/src/services/surveySchema.service.ts` to copy `optionConfigs` from `SurveyQuestionInput` into the built `SurveyQuestion`
- [x] T026 [US5] Update `validateQuestionInput` in `chat-backend/src/services/surveySchema.service.ts` to validate `optionConfigs`: only permitted on `single_choice` and `multi_choice` types; each `label` must match an entry in `options[]`; `freetextType` must be `'string'` or `'number'`
- [x] T027 [US5] Update `chat-backend/src/services/surveyResponse.service.ts` to validate `freetextValues` in submitted answers: each key must be a selected option label (present in `value`); if `freetextType === 'number'`, the value string must be parseable as a finite number; return 422 with descriptive message on violation

### Workbench Frontend (workbench-frontend) — can start after T009, parallel with backend

- [x] T028 [P] [US5] Create new component `workbench-frontend/src/features/workbench/surveys/components/OptionEditor.tsx`: renders a single option row with label input, freetext toggle checkbox, and (when toggled on) a string/number type selector; emits `onChange` with updated `ChoiceOptionConfig`
- [x] T029 [US5] Update `workbench-frontend/src/features/workbench/surveys/components/QuestionEditor.tsx` to render `OptionEditor` for each entry in `options[]` when question type is `single_choice` or `multi_choice`; maintain `optionConfigs` state synchronized with option add/remove/reorder
- [x] T030 [US5] Update `toEditorQuestions` in `workbench-frontend/src/features/workbench/surveys/components/QuestionList.tsx` to include `optionConfigs` in the mapped editor question shape
- [x] T031 [US5] Update the `currentSchema` → local state mapping in `workbench-frontend/src/features/workbench/surveys/SurveySchemaEditorView.tsx` to include `optionConfigs` in the `questions` state entries

### chat-frontend-common — can start after T009, parallel with backend and workbench-frontend

- [x] T032 [P] [US5] Update `chat-frontend-common/src/survey-ui/SingleChoiceInput.tsx` to accept `optionConfigs?: ChoiceOptionConfig[]` prop; when the selected option has `freetextEnabled: true`, render an inline text (or number) input immediately below the option; emit the freetext value via a new `onFreetext?: (optionLabel: string, value: string) => void` callback
- [x] T033 [P] [US5] Update `chat-frontend-common/src/survey-ui/MultiChoiceInput.tsx` to accept `optionConfigs?: ChoiceOptionConfig[]` prop; for each checked option with `freetextEnabled: true`, render an inline freetext input; enforce numeric-only constraint when `freetextType === 'number'`; emit freetext values via `onFreetext` callback

### chat-frontend — depends on T032/T033

- [x] T034 [US5] Update `chat-frontend/src/stores/surveyGateStore.ts` to store `freetextValues: Record<string, string>` per question answer in state; extend `setAnswer` to accept optional `freetextValues` parameter; include `freetextValues` in the survey response submission payload
- [x] T035 [US5] Update `chat-frontend/src/features/survey/SurveyForm.tsx` and `QuestionRenderer` to pass `optionConfigs` from the schema question to `SingleChoiceInput` / `MultiChoiceInput` and wire up the `onFreetext` handler to `surveyGateStore`

### i18n for US5

- [x] T036 [P] [US5] Add i18n keys for freetext option editor to `workbench-frontend/src/locales/en.json`, `uk.json`, `ru.json`: `survey.option.freetextLabel`, `survey.option.freetextType.string`, `survey.option.freetextType.number`; add freetext placeholder keys to `chat-frontend-common/src/locales/en.json`, `uk.json`, `ru.json`
- [x] T041 [US5] Add `freetextRequired` support: (a) in `workbench-frontend/src/features/workbench/surveys/components/OptionEditor.tsx` add a "Required freetext" checkbox shown when freetext toggle is on; (b) update `chat-backend/src/services/surveyResponse.service.ts` to enforce non-empty `freetextValues[label]` when option is selected and `freetextRequired: true` (422 if blank); (c) update `chat-frontend-common/src/survey-ui/SingleChoiceInput.tsx` and `MultiChoiceInput.tsx` to mark the inline freetext input as required when `freetextRequired` is set

**Checkpoint**: US5 complete. Freetext options work in editor, preview, and gate flow. Answers stored with freetextValues. Required freetext enforced end-to-end.

---

## Phase 8: Polish & Cross-Cutting Concerns
**Jira**: [MTB-613](https://mentalhelpglobal.atlassian.net/browse/MTB-613)

- [x] T037 [P] Update `chat-backend` schema export service to serialize `visibilityConditions`, `visibilityConditionCombinator`, and `optionConfigs` in export format version 2; update import to accept both version 1 (legacy `visibilityCondition` only) and version 2 (new fields) in `chat-backend/src/services/surveySchema.service.ts`
- [x] T038 [P] Verify workbench schema export/import round-trip: export a schema with multi-conditions and freetext options, reimport it — all fields must survive the round-trip without loss in `workbench-frontend/src/features/workbench/surveys/components/SchemaExportButton.tsx` (and import handler)
- [x] T039 [P] Run Playwright smoke test in `chat-ui` against deployed dev environment: create schema with multi-condition question and freetext option, complete survey gate flow end-to-end, verify no 422 errors and freetextValues are recorded in the response
- [x] T042 [P] Verify WCAG AA compliance and keyboard navigation for all new interactive UI components: `workbench-frontend/src/features/workbench/surveys/components/VisibilityConditionEditor.tsx` (multi-condition list, AND/OR toggle, add/remove buttons), `OptionEditor.tsx` (freetext toggle, type selector), tag-style multi-value input — confirm focus order, aria-labels, and screen-reader announcements; test in `workbench-frontend` and `chat-frontend-common`
- [x] T043 [P] Verify responsive layout of new editor and survey input components at mobile (≤375px), tablet (≤768px), and desktop (≥1024px): `VisibilityConditionEditor`, `OptionEditor`, freetext inline inputs in `chat-frontend-common/src/survey-ui/SingleChoiceInput.tsx` and `MultiChoiceInput.tsx` — no horizontal overflow, no truncated controls, all interactions operable on touch

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ──────────────────────────────── no deps, start immediately
    │
Phase 2 (Foundational — chat-types) ──────────── depends on Phase 1
    │
    ├─── Phase 3 (US1 — tests only)     ─── [P] no new feature code; depends on Phase 2
    ├─── Phase 4 (US2 — spaces filter)  ─── [P] independent of all other US; depends on Phase 2
    ├─── Phase 5 (US3 — multi-condition) ── depends on Phase 2; US4 must follow US3
    │       └─── Phase 6 (US4 — multi-value) ── depends on US3 (T017) complete
    └─── Phase 7 (US5 — freetext)       ─── [P] independent of US3/US4; depends on Phase 2
         └─── Phase 8 (Polish) ─────────────── depends on all user story phases
```

### User Story Dependencies

| Story | Depends On | Can Parallelize With |
|-------|-----------|---------------------|
| US1 (tests) | Phase 2 (chat-types build) | US2, US3, US5 |
| US2 (spaces filter) | Phase 2 | US1, US3, US5 |
| US3 (multi-condition) | Phase 2 | US2, US5 |
| US4 (multi-value) | US3 T017 | US2, US5 |
| US5 (freetext) | Phase 2 | US1, US2, US3 |

### Within Each Phase

- Backend tasks before workbench/frontend tasks (same story)
- Models/types before services before UI
- `QuestionList.toEditorQuestions` before `SurveySchemaEditorView` state mapping

---

## Parallel Execution Examples

### After Phase 2 completes — launch all stories simultaneously

```
Stream A: US1 (T010, T011, T012) — tests in chat-types/backend/frontend
Stream B: US2 (T013, T014)       — spaces filter in workbench-frontend
Stream C: US3 (T015–T021)        — multi-condition in backend + workbench-frontend
Stream D: US5 (T025–T036)        — freetext across all 4 repos
```

### Within US5 — parallel after T009

```
Backend:              T025 → T026 → T027
Workbench (editor):   T028 → T029 → T030 → T031
chat-frontend-common: T032 [P]  T033 [P]
i18n:                 T036 [P]
```
*(chat-frontend T034/T035 depends on T032/T033 being done)*

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Complete Phase 1 + Phase 2 (Setup + chat-types)
2. Complete Phase 3 (US1 — tests)
3. Complete Phase 4 (US2 — spaces filter)
4. **STOP and VALIDATE**: Spaces filter works, visibility-required invariant is tested
5. Deploy to dev

### Incremental Delivery

1. Setup + Foundational → chat-types ready
2. US1 → regression tests in place
3. US2 → spaces filter fixed and deployed
4. US3 → multi-condition visibility in editor + gate flow
5. US4 → multi-value `IN`/`NOT_IN` extension (small delta on US3)
6. US5 → freetext options — largest story, all layers
7. Polish → export/import and E2E smoke test

### Recommended Team Split (if multiple developers)

- **Dev A**: chat-types (Phase 2) → US1 tests → US3/US4 backend
- **Dev B**: US2 spaces filter → US5 workbench-frontend (OptionEditor)
- **Dev C**: US3/US4 workbench-frontend editor → US5 chat-frontend-common/chat-frontend

---

## Notes

- All `[P]` tasks touch different files and have no incomplete task dependencies
- Every user story is independently deployable after its phase completes
- chat-types local file reference (not npm registry) in CI — no publish step needed between repos for dev builds
- i18n keys must be added in all 3 locales (en, uk, ru) in the same commit as the UI component
- Backward compat: `visibilityCondition` (singular) must continue to work in gate flow for all existing published schemas
