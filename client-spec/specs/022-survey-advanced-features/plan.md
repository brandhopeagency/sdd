# Implementation Plan: Survey Advanced Features

**Branch**: `022-survey-advanced-features` | **Date**: 2026-03-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-survey-advanced-features/spec.md`

## Summary

Five capability additions to the survey module, delivered across five repositories:

1. **Researcher spaces filter** — replace `user.memberships` in `ReviewQueueView` with `groups.list()` API so all accessible spaces appear in the review queue scope selector.
2. **Visibility priority over required** — already correctly implemented in backend and frontend; test coverage added to formalize the invariant.
3. **Multiple visibility conditions (AND/OR)** — extend `SurveyQuestion` with `visibilityConditions[]` + `combinator` field; update `evaluateVisibility` in `chat-types`; update schema editor UI in `workbench-frontend`.
4. **Multi-value comparison** — no type changes needed (already supported); update `VisibilityConditionEditor` UI to allow entering multiple values; add `NOT_IN` operator.
5. **Freetext on choice options** — add `ChoiceOptionConfig[]` and `SurveyAnswer.freetextValues` to `chat-types`; update question editor, choice input components, and answer submission.

Execution order: `chat-types` → `chat-backend` → `workbench-frontend` → `chat-frontend-common` → `chat-frontend`.

## Technical Context

**Language/Version**: TypeScript 5.x (all repositories)
**Primary Dependencies**:
- `chat-types`: no runtime deps (pure types + pure functions)
- `chat-backend`: Express.js, pg (PostgreSQL), Vitest
- `workbench-frontend`: React 18, Zustand, React Router, Tailwind CSS, Vite
- `chat-frontend-common`: React 18, shared UI library (no router)
- `chat-frontend`: React 18, Zustand, React Router, Tailwind CSS, Vite
**Storage**: PostgreSQL JSONB columns (`survey_schemas.questions`, `survey_responses.answers`) — no migration required (additive fields)
**Testing**: Vitest (backend unit), Vitest + React Testing Library (frontend unit), Playwright (E2E in `chat-ui`)
**Target Platform**: Cloud Run (backend), GCS static (frontends)
**Project Type**: Multi-repo web application (backend API + two React SPA frontends + shared library)
**Performance Goals**: No new performance requirements; existing survey endpoints must continue to respond under 500ms p95
**Constraints**: Zero breaking changes to persisted JSONB schemas; all new fields optional; backward-compatible `evaluateVisibility`
**Scale/Scope**: Affects all active surveys; change touches 5 repositories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-First | ✅ Pass | spec.md exists and is complete |
| II. Multi-Repo Orchestration | ✅ Pass | plan.md documents all 5 target repos and execution order |
| III. Test-Aligned | ✅ Pass | Vitest for backend/frontend, Playwright E2E noted |
| IV. Branch Discipline | ✅ Pass | Feature branch `022-survey-advanced-features` in all affected repos; PRs to `develop` only |
| V. Privacy & Security | ✅ Pass | No new PII fields; no auth changes; survey answers already protected |
| VI. Accessibility & i18n | ✅ Pass | New UI elements (multi-value input, freetext field) need WCAG AA + i18n keys in all 3 locales |
| VII. Split-Repo First | ✅ Pass | `chat-types` changes flow to all consumers via local file reference in CI |
| VIII. GCP CLI Infra | ✅ Pass | No infrastructure changes |
| IX. Responsive UX & PWA | ✅ Pass | New editor and survey input controls must be responsive; PWA cache not affected |
| X. Jira Traceability | ✅ Pass | Epic + Stories + Tasks will be created via `/speckit.tasks` |
| XI. Documentation | ✅ Pass | User Manual + Release Notes updates required on production deploy |
| XII. Release Engineering | ✅ Pass | No topology changes; standard feature release cycle |

## Project Structure

### Documentation (this feature)

```text
specs/022-survey-advanced-features/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Architecture decisions
├── data-model.md        # Type changes
├── contracts/
│   └── survey-schema-api.md   # API payload contract changes
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (affected repositories)

```text
chat-types/
└── src/
    └── survey.ts                          # VisibilityConditionOperator, ChoiceOptionConfig,
                                           # SurveyQuestion, SurveyQuestionInput,
                                           # SurveyAnswer, evaluateVisibility

chat-backend/
└── src/
    ├── services/
    │   ├── surveySchema.service.ts        # buildQuestion, validateQuestionInput
    │   └── surveyResponse.service.ts      # answer validation + freetext
    └── routes/
        └── survey.ts                      # (no route changes; validation only)

workbench-frontend/
└── src/
    ├── features/workbench/
    │   ├── review/
    │   │   └── ReviewQueueView.tsx        # spaces filter fix
    │   └── surveys/
    │       ├── SurveySchemaEditorView.tsx # pass new fields through editor state
    │       └── components/
    │           ├── QuestionList.tsx       # toEditorQuestions — include new fields
    │           ├── QuestionEditor.tsx     # expose optionConfigs in editor
    │           ├── VisibilityConditionEditor.tsx  # multi-condition, AND/OR, multi-value
    │           └── OptionEditor.tsx               # NEW: per-option freetext toggle
    └── locales/                           # en/uk/ru i18n keys for new UI

chat-frontend-common/
└── src/
    └── survey-ui/
        ├── SingleChoiceInput.tsx          # freetext option support
        ├── MultiChoiceInput.tsx           # freetext option support
        └── index.ts                       # re-export ChoiceOptionConfig if needed

chat-frontend/
└── src/
    ├── stores/
    │   └── surveyGateStore.ts             # freetextValues in answer state + submission
    └── features/survey/
        └── SurveyForm.tsx                 # pass freetextValues through to answer store
```

## Phase 0: Research

Complete. See [research.md](./research.md).

**Key decisions**:
- Multi-condition: additive `visibilityConditions[]` + `combinator` on `SurveyQuestion`; legacy `visibilityCondition` preserved for backward compat.
- Multi-value UI: No type changes; update editor to allow array input; add `NOT_IN` enum value.
- Freetext on options: Parallel `optionConfigs[]` field; `SurveyAnswer.freetextValues` for answer capture.
- Spaces filter: Use existing `groups.list()` API; no backend changes.
- Visibility priority: Already implemented; add tests.

## Phase 1: Design

Complete. See [data-model.md](./data-model.md) and [contracts/survey-schema-api.md](./contracts/survey-schema-api.md).

## Phase 2: Implementation Plan

### US1 — Researcher Spaces Filter (P2)

**Target repo**: `workbench-frontend`
**Dependencies**: None (uses existing `groups.list()` API)

Steps:
1. In `ReviewQueueView.tsx`, add `useEffect` on mount to call `adminApi.groups.list()` and store result in local state (`allGroups`).
2. Replace `activeMemberships.map(...)` options with `allGroups.map(...)` in the scope `<select>`.
3. Add loading state while groups fetch.
4. Add i18n key for any new label text (en/uk/ru).

---

### US2 — Visibility Priority Over Required (P1)

**Target repos**: `chat-types` (tests), `chat-backend` (tests), `chat-frontend` (tests)
**Dependencies**: None (logic already correct; tests only)

Steps:
1. Add Vitest unit test in `chat-types` asserting `evaluateVisibility` marks a required question invisible when its condition is not met.
2. Add Vitest test in `chat-backend/surveyResponse.service.ts` asserting submission with a hidden required question succeeds.
3. Add Vitest test in `chat-frontend/surveyGateStore.ts` asserting survey can advance past a hidden required question without validation error.

---

### US3 — Multiple Visibility Conditions with AND/OR (P3)

**Target repos**: `chat-types` → `chat-backend` → `workbench-frontend` → `chat-frontend-common` → `chat-frontend`

#### chat-types
1. Add `visibilityConditions?: VisibilityCondition[] | null` and `visibilityConditionCombinator?: 'and' | 'or' | null` to `SurveyQuestion` and `SurveyQuestionInput`.
2. Update `evaluateVisibility`: if `visibilityConditions` non-empty, evaluate with combinator; else fall back to `visibilityCondition`.
3. Update `ExportQuestion` with new fields; bump `CURRENT_SCHEMA_EXPORT_VERSION` to `2`.
4. Bump `chat-types` package minor version.

#### chat-backend
1. Update `buildQuestion` to copy `visibilityConditions` and `visibilityConditionCombinator` from input.
2. Update `validateQuestionInput` to validate each entry in `visibilityConditions[]` (operator, forward-reference check).
3. Update schema import/export if applicable.

#### workbench-frontend
1. Redesign `VisibilityConditionEditor.tsx`:
   - Show a list of conditions (add/remove)
   - AND/OR combinator toggle (shown when ≥2 conditions)
   - Each condition row: question select, operator select, value input(s)
2. Update `QuestionEditor.tsx` to use the new multi-condition editor shape.
3. Update `toEditorQuestions` in `QuestionList.tsx` to pass through `visibilityConditions` and `visibilityConditionCombinator`.
4. Update `SurveySchemaEditorView.tsx` state mapping to include new fields.
5. Add i18n keys (en/uk/ru) for new editor labels.

#### chat-frontend-common
- `evaluateVisibility` is consumed from `chat-types`. No changes to UI components needed for conditions alone.

#### chat-frontend
- `surveyGateStore.ts` imports `evaluateVisibility` from `chat-types`; no change needed as the function signature is unchanged.

---

### US4 — Multi-value Comparison in Conditions (P4)

**Target repos**: `chat-types` → `chat-backend` → `workbench-frontend`

#### chat-types
1. Add `NOT_IN = 'not_in'` to `VisibilityConditionOperator`.
2. Update `evaluateVisibility` → `evaluateCondition` to handle `NOT_IN`: returns true if answer not in expected array.

#### chat-backend
1. Update `validateQuestionInput` to accept `not_in` as valid operator.
2. No other backend changes (value is already `string | string[] | boolean`).

#### workbench-frontend
1. Update `VisibilityConditionEditor` to:
   - Show `not_in` as an operator option (label: "is not one of").
   - For `in` and `not_in` operators: replace single text input with a tag-style multi-value input (add/remove individual values).
   - For `equals` and `not_equals`: keep single value input (storing as scalar string).
2. Add i18n keys for new operator labels.

---

### US5 — Freetext on Choice Options (P5)

**Target repos**: `chat-types` → `chat-backend` → `workbench-frontend` → `chat-frontend-common` → `chat-frontend`

#### chat-types
1. Add `ChoiceOptionConfig` interface.
2. Add `optionConfigs?: ChoiceOptionConfig[] | null` to `SurveyQuestion` and `SurveyQuestionInput`.
3. Add `freetextValues?: Record<string, string> | null` to `SurveyAnswer`.

#### chat-backend
1. Update `buildQuestion` to copy `optionConfigs` from input.
2. Update `validateQuestionInput`:
   - `optionConfigs` only valid on `single_choice` / `multi_choice`.
   - Each `label` must exist in `options[]`.
3. Update `surveyResponse.service.ts` answer validation:
   - If `freetextValues` present, validate each key is in `value` (selected options).
   - If `freetextType === 'number'`, validate value is numeric.

#### workbench-frontend (OptionEditor — NEW component)
1. Create `OptionEditor.tsx` for the per-option freetext configuration (toggle on/off, select string vs number).
2. Update `QuestionEditor.tsx` for `single_choice` / `multi_choice`: render `OptionEditor` per option row.
3. Update `toEditorQuestions` to pass through `optionConfigs`.
4. Update `SurveySchemaEditorView.tsx` state mapping.
5. Add i18n keys.

#### chat-frontend-common
1. Update `SingleChoiceInput.tsx`: when selected option has `freetextEnabled`, show inline text/number input; capture in `onAnswer` callback (extend signature or use separate `onFreetext` callback).
2. Update `MultiChoiceInput.tsx`: same pattern per each freetext-enabled option that is checked.
3. Both components must handle the `freetextType: 'number'` input constraint.

#### chat-frontend
1. Update `surveyGateStore.ts`:
   - Answer state stores `freetextValues` alongside `value`.
   - `setAnswer` accepts optional `freetextValues` parameter.
   - Submission payload includes `freetextValues` per answer.
2. Update `SurveyForm.tsx` in `chat-frontend` to pass the new handler shape to `QuestionRenderer` / `SurveyForm` from common.

## Cross-repository Dependency Order

```
chat-types (types + evaluateVisibility)
    ↓
chat-backend (validation, persistence)
    ↓
workbench-frontend (schema editor)
chat-frontend-common (survey UI inputs)
    ↓
chat-frontend (gate flow)
```

`workbench-frontend` and `chat-frontend-common` can be worked on in parallel after `chat-types` and `chat-backend` are merged.

## i18n Requirements

All new UI text must be added to `en`, `uk`, and `ru` locale files in `workbench-frontend` and `chat-frontend-common`:

| Key (example) | UI location |
|---------------|-------------|
| `survey.condition.addCondition` | + Add condition button |
| `survey.condition.combinator.and` | AND toggle label |
| `survey.condition.combinator.or` | OR toggle label |
| `survey.condition.operator.not_in` | Operator dropdown label |
| `survey.condition.multiValue.addValue` | Add value chip button |
| `survey.option.freetextLabel` | Freetext option toggle label |
| `survey.option.freetextType.string` | Type selector option |
| `survey.option.freetextType.number` | Type selector option |
| `review.queue.scope.loadingSpaces` | Loading state for spaces filter |

## Complexity Tracking

No constitution violations. All changes are additive; no new projects, abstraction layers, or infrastructure required.
