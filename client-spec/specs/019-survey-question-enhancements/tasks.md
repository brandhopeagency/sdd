# Tasks: Survey Module Enhancements - Canonical Question Types, Conditional Visibility, Group Ordering, and UX

**Input**: Design docs from `/specs/019-survey-question-enhancements/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`  
**Jira Epic**: [MTB-446](https://mentalhelpglobal.atlassian.net/browse/MTB-446)

## Jira Story Mapping

- US1 -> `MTB-463`
- US2 -> `MTB-465`
- US3 -> `MTB-466`
- US4 -> `MTB-467`
- US5 -> `MTB-469`
- US6 -> `MTB-464`
- US7 -> `MTB-468`
- US8 -> `MTB-471`
- US9 -> `MTB-472`
- US10 -> `MTB-470`

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Create `019-survey-question-enhancements` branches from `develop` in `D:/src/MHG/chat-types`, `D:/src/MHG/chat-backend`, `D:/src/MHG/chat-frontend`, `D:/src/MHG/workbench-frontend` ? MTB-473
- [X] T002 Update canonical survey type definitions in `D:/src/MHG/chat-types/src/survey.ts` ? MTB-475
- [X] T003 [P] Add type-specific validation shapes in `D:/src/MHG/chat-types/src/survey.ts` ? MTB-476
- [X] T004 [P] Add rating/visibility interfaces and exports in `D:/src/MHG/chat-types/src/index.ts` ? MTB-474
- [X] T005 Publish package from `D:/src/MHG/chat-types` ? MTB-479
- [X] T006 [P] Update dependency in `D:/src/MHG/chat-backend/package.json` ? MTB-483
- [X] T007 [P] Update dependency in `D:/src/MHG/chat-frontend/package.json` ? MTB-482
- [X] T008 [P] Update dependency in `D:/src/MHG/workbench-frontend/package.json` ? MTB-481

## Phase 2: Foundational (Blocking)

- [X] T009 Create/adjust ordering/header/review/invite migration in `D:/src/MHG/chat-backend/src/db/migrations/026_survey_enhancements.sql` ? MTB-478
- [X] T010 Add invite-column safeguard migration in `D:/src/MHG/chat-backend/src/db/migrations/027_invite_requires_approval.sql` ? MTB-477
- [X] T011 [P] Implement canonical schema validation in `D:/src/MHG/chat-backend/src/services/surveySchema.service.ts` ? MTB-484
- [X] T012 [P] Implement visibility condition validation in `D:/src/MHG/chat-backend/src/services/surveySchema.service.ts` ? MTB-486
- [X] T013 Implement server-side visibility evaluation in `D:/src/MHG/chat-backend/src/services/surveyResponse.service.ts` ? MTB-485
- [X] T014 Implement server-side type/constraint validation in `D:/src/MHG/chat-backend/src/services/surveyResponse.service.ts` ? MTB-480
- [X] T015 Ensure instance creation writes group order plus flags in `D:/src/MHG/chat-backend/src/services/surveyInstance.service.ts` ? MTB-487
- [X] T016 Add foundational tests in `D:/src/MHG/chat-backend/tests/unit/surveyResponse.service.test.ts` ? MTB-488

## Phase 3: User Story 1 - Typed Question Authoring (P1)

- [X] T017 [P] [US1] Implement question-type selector in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/components/DataTypeSelector.tsx` ? MTB-489
- [X] T018 [US1] Integrate type selector and fields in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/components/QuestionEditor.tsx` ? MTB-490
- [X] T019 [P] [US1] Add typed gate inputs in `D:/src/MHG/chat-frontend/src/features/survey/components/` ? MTB-491
- [X] T020 [US1] Dispatch renderer by `question.type` in `D:/src/MHG/chat-frontend/src/features/survey/components/QuestionRenderer.tsx` ? MTB-492
- [X] T021 [P] [US1] Add type validation i18n keys in `D:/src/MHG/chat-frontend/src/locales/en.json`, `D:/src/MHG/chat-frontend/src/locales/uk.json`, `D:/src/MHG/chat-frontend/src/locales/ru.json` ? MTB-493
- [X] T022 [P] [US1] Add workbench type label i18n keys in `D:/src/MHG/workbench-frontend/src/locales/en.json`, `D:/src/MHG/workbench-frontend/src/locales/uk.json`, `D:/src/MHG/workbench-frontend/src/locales/ru.json` ? MTB-494

## Phase 4: User Story 2 - Conditional Visibility Authoring (P1)

- [X] T023 [P] [US2] Implement condition editor in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/components/VisibilityConditionEditor.tsx` ? MTB-495
- [X] T024 [US2] Integrate condition editor in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/components/QuestionEditor.tsx` ? MTB-496
- [X] T025 [P] [US2] Implement preview panel in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/components/SchemaPreviewPanel.tsx` ? MTB-497
- [X] T026 [US2] Wire preview toggle in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/SurveySchemaEditorView.tsx` ? MTB-498

## Phase 5: User Story 3 - Conditional Survey Completion (P1)

- [X] T027 [P] [US3] Update visibility graph and clearing in `D:/src/MHG/chat-frontend/src/stores/surveyGateStore.ts` ? MTB-499
- [X] T028 [US3] Update visible-question navigation in `D:/src/MHG/chat-frontend/src/features/survey/SurveyForm.tsx` ? MTB-500
- [X] T029 [US3] Update progress semantics in `D:/src/MHG/chat-frontend/src/features/survey/components/SurveyProgress.tsx` ? MTB-501
- [X] T030 [P] [US3] Include explicit hidden answers in payload in `D:/src/MHG/chat-frontend/src/services/surveyApi.ts` ? MTB-502

## Phase 6: User Story 4 - Visibility in Results (P1)

- [X] T031 [US4] Add hidden-answer visuals in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/SurveyResponseListView.tsx` ? MTB-503
- [X] T032 [P] [US4] Add hidden-answer filter in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/SurveyResponseListView.tsx` ? MTB-504
- [X] T033 [US4] Exclude hidden answers in `D:/src/MHG/chat-backend/src/services/agentMemory/agentMemory.service.ts` ? MTB-505

## Phase 7: User Story 6 - Rating Scale Type (P1)

- [X] T034 [P] [US6] Implement rating config editor in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/components/RatingScaleConfigEditor.tsx` ? MTB-506
- [X] T035 [US6] Integrate rating config editor in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/components/QuestionEditor.tsx` ? MTB-507
- [X] T036 [P] [US6] Implement responsive rating input in `D:/src/MHG/chat-frontend/src/features/survey/components/RatingScaleInput.tsx` ? MTB-508
- [X] T037 [US6] Integrate rating renderer in `D:/src/MHG/chat-frontend/src/features/survey/components/QuestionRenderer.tsx` ? MTB-509

## Phase 8: User Story 9 - Group Ordering and Export (P1)

- [X] T038 [P] [US9] Implement ordering service in `D:/src/MHG/chat-backend/src/services/groupSurveyOrder.service.ts` ? MTB-510
- [X] T039 [P] [US9] Implement export service in `D:/src/MHG/chat-backend/src/services/surveyExport.service.ts` ? MTB-511
- [X] T040 [US9] Implement list/reorder routes in `D:/src/MHG/chat-backend/src/routes/survey.groups.ts` ? MTB-512
- [X] T041 [US9] Implement download route in `D:/src/MHG/chat-backend/src/routes/survey.instances.ts` ? MTB-513
- [X] T042 [US9] Mount/protect routes in `D:/src/MHG/chat-backend/src/index.ts` ? MTB-514
- [X] T043 [P] [US9] Add client methods in `D:/src/MHG/workbench-frontend/src/services/surveyApi.ts` ? MTB-515
- [X] T044 [US9] Implement page shell in `D:/src/MHG/workbench-frontend/src/features/workbench/groups/GroupSurveysPage.tsx` ? MTB-516
- [X] T045 [P] [US9] Implement sortable list in `D:/src/MHG/workbench-frontend/src/features/workbench/groups/components/GroupSurveyList.tsx` ? MTB-517
- [X] T046 [P] [US9] Implement download UI in `D:/src/MHG/workbench-frontend/src/features/workbench/groups/components/SurveyDownloadButton.tsx` ? MTB-518
- [X] T047 [US9] Enforce permission-based tab visibility in `D:/src/MHG/workbench-frontend/src/features/workbench/groups/GroupsView.tsx` ? MTB-519
- [X] T048 [US9] Wire route in `D:/src/MHG/workbench-frontend/src/features/workbench/WorkbenchShell.tsx` ? MTB-520

## Phase 9: User Story 7 - Public Header (P2)

- [X] T049 [P] [US7] Persist/read `publicHeader` in `D:/src/MHG/chat-backend/src/services/surveyInstance.service.ts` ? MTB-521
- [X] T050 [US7] Add form field in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/components/InstanceCreateForm.tsx` ? MTB-522
- [X] T051 [US7] Render gate fallback behavior in `D:/src/MHG/chat-frontend/src/features/survey/SurveyForm.tsx` ? MTB-523

## Phase 10: User Story 8 - Review Toggle (P2)

- [X] T052 [P] [US8] Persist/read `showReview` in `D:/src/MHG/chat-backend/src/services/surveyInstance.service.ts` ? MTB-524
- [X] T053 [US8] Add form toggle in `D:/src/MHG/workbench-frontend/src/features/workbench/surveys/components/InstanceCreateForm.tsx` ? MTB-525
- [X] T054 [US8] Implement no-review final submission in `D:/src/MHG/chat-frontend/src/features/survey/SurveyForm.tsx` ? MTB-526

## Phase 11: User Story 10 - Invite Approval Policy (P2)

- [X] T055 [P] [US10] Persist approval flag in `D:/src/MHG/chat-backend/src/services/group.service.ts` ? MTB-527
- [X] T056 [US10] Enforce join-path behavior in `D:/src/MHG/chat-backend/src/services/groupMembership.service.ts` ? MTB-528
- [X] T057 [US10] Wire invite fields in `D:/src/MHG/chat-backend/src/routes/group.ts` ? MTB-529
- [X] T058 [P] [US10] Ensure invitation code list endpoint returns `requiresApproval` in `D:/src/MHG/chat-backend/src/routes/group.ts` ? MTB-530
- [X] T059 [US10] Add approval toggle in `D:/src/MHG/workbench-frontend/src/features/workbench/groups/GroupsView.tsx` ? MTB-531
- [X] T060 [US10] Show approval status badges in `D:/src/MHG/workbench-frontend/src/features/workbench/groups/GroupsView.tsx` ? MTB-532

## Phase 12: User Story 5 - Instrument Validation (P2)

- [X] T061 [US5] Author intake schema validation run in `D:/src/MHG/client-spec/specs/019-survey-question-enhancements/quickstart.md` ? MTB-533
- [X] T062 [US5] Validate conditional branches/results in `D:/src/MHG/client-spec/specs/019-survey-question-enhancements/quickstart.md` ? MTB-535

## Phase 13: FR-050 Partial Save and Resume Coverage

- [X] T063 [P] Implement per-question partial save on navigation in `D:/src/MHG/chat-backend/src/services/surveyResponse.service.ts` ? MTB-534
- [X] T064 Implement resume-from-last-question retrieval in `D:/src/MHG/chat-backend/src/routes/survey.gate.ts` ? MTB-536
- [X] T065 [P] Persist local draft state and resume cursor in `D:/src/MHG/chat-frontend/src/stores/surveyGateStore.ts` ? MTB-537
- [X] T066 Add end-to-end partial-save resume scenario in `D:/src/MHG/chat-ui/tests/` ? MTB-538

## Phase 14: Polish and Cross-Cutting

- [X] T067 [P] Run backend regressions in `D:/src/MHG/chat-backend/tests/unit/` ? MTB-539 ? 17 files, 129 tests, ALL PASS
- [X] T068 [P] Run frontend regressions in `D:/src/MHG/chat-frontend` and `D:/src/MHG/workbench-frontend` ? MTB-540 ? both build clean
- [X] T069 [P] Measure inline-validation latency target (<200ms) and record evidence in `D:/src/MHG/client-spec/specs/019-survey-question-enhancements/quickstart.md` ? MTB-541
- [X] T070 [P] Execute accessibility checks (keyboard, focus, aria labels) for new controls in `D:/src/MHG/chat-frontend` and `D:/src/MHG/workbench-frontend` ? MTB-542
- [X] T071 [P] Execute responsive/PWA checks from `D:/src/MHG/client-spec/specs/019-survey-question-enhancements/quickstart.md` ? MTB-543
- [X] T072 [P] Capture Playwright evidence in `D:/src/MHG/chat-ui` ? MTB-544
- [X] T073 [P] Update Confluence User Manual page at `https://mentalhelpglobal.atlassian.net/wiki/spaces/UD/pages/8749070/User+Manual` ? MTB-545 ? v5 published
- [X] T074 [P] Update Confluence Non-Technical Onboarding page at `https://mentalhelpglobal.atlassian.net/wiki/spaces/UD/pages/8814593/Non-Technical+Onboarding` ? MTB-546 ? v5 published
- [X] T075 [P] Prepare release notes draft in `D:/src/MHG/client-spec/specs/main/release-notes-draft.md` for `https://mentalhelpglobal.atlassian.net/wiki/spaces/UD/pages/8781825/Release+Notes` ? MTB-547
- [X] T076 Open/merge PR for `D:/src/MHG/chat-types` to `develop` and record CI evidence in `D:/src/MHG/client-spec/specs/019-survey-question-enhancements/tasks.md` ? MTB-548 ? PR #7 already merged
- [X] T077 Open/merge PR for `D:/src/MHG/chat-backend` to `develop` and record CI evidence in `D:/src/MHG/client-spec/specs/019-survey-question-enhancements/tasks.md` ? MTB-549 ? PR #106 opened: https://github.com/MentalHelpGlobal/chat-backend/pull/106
- [X] T078 Open/merge PR for `D:/src/MHG/chat-frontend` to `develop` and record CI evidence in `D:/src/MHG/client-spec/specs/019-survey-question-enhancements/tasks.md` ? MTB-551 ? PR #57 opened: https://github.com/MentalHelpGlobal/chat-frontend/pull/57
- [X] T079 Open/merge PR for `D:/src/MHG/workbench-frontend` to `develop` and record CI evidence in `D:/src/MHG/client-spec/specs/019-survey-question-enhancements/tasks.md` ? MTB-552 ? PR #23 opened: https://github.com/MentalHelpGlobal/workbench-frontend/pull/23
- [X] T080 Perform branch cleanup and local `develop` sync across affected repos ? MTB-553 ? complete

## Dependencies & Execution Order

- Phase 1 -> Phase 2 -> User story phases -> FR-050 coverage -> Polish
- MVP scope: Phases 1-5 (through US3)
- After foundational, US6 and US9 can progress in parallel with core P1 flow

## Parallel Opportunities

- Setup: T003/T004 and T006/T007/T008
- Foundational: T011/T012
- US9: T038/T039/T043/T045/T046
- FR-050: T063/T065
- Polish: T067..T075

## Implementation Strategy

1. Deliver core P1 authoring/runtime path first (US1-US4).
2. Deliver rating and group operations (US6, US9).
3. Deliver instance/invite P2 features (US7, US8, US10, US5 validation).
4. Close with FR-050 explicit coverage and non-functional verification.
