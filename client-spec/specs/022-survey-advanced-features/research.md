# Research: Survey Advanced Features

**Branch**: `022-survey-advanced-features`
**Date**: 2026-03-06

---

## Decision 1: Multi-condition visibility data model

**Decision**: Extend `SurveyQuestion` with a new `visibilityConditions` field (array) and `visibilityConditionCombinator` field (`'and' | 'or'`). Deprecate (but preserve) the existing single `visibilityCondition` field for backward compatibility with stored schema snapshots.

**Rationale**:
- The existing `VisibilityCondition` type is well-defined and needs no structural change — only the cardinality changes from 1 to N.
- Storing conditions as a parallel `visibilityConditions` array + `combinator` avoids breaking all schema snapshots persisted in `survey_responses.answers` JSONB columns.
- `evaluateVisibility` in `chat-types` can transparently handle both: if `visibilityConditions` is present and non-empty, use it; otherwise fall back to `visibilityCondition`.
- Flat AND/OR (all conditions share one combinator) is sufficient for initial release and explicitly scoped in the spec. No nested group support needed.

**Alternatives considered**:
- Replace `visibilityCondition` with `visibilityConditions` (breaking): Rejected because existing schema snapshots stored in `survey_responses` JSONB would lose their condition data without a migration.
- Separate `VisibilityConditionGroup` wrapper object: Considered but adds indirection without value for the simple flat AND/OR case.

---

## Decision 2: Multi-value comparison in conditions

**Decision**: No type-level changes required. The existing `VisibilityCondition.value: string | string[] | boolean` already supports arrays, and the `IN` operator already evaluates `expected.includes(answer)`. The only change is **UI-level**: the `VisibilityConditionEditor` needs to allow entering multiple values for the `equals`, `not_equals`, and `in` operators.

**Rationale**:
- The `evaluateVisibility` function in `chat-types` at `VisibilityConditionOperator.IN` already handles `Array.isArray(expected)`.
- Adding a `NOT_IN` operator would be a minor addition to the enum and evaluator for the "none of" case.
- The `EQUALS` operator with a single-element array behaves identically to a scalar check — no semantic change needed.

**Alternatives considered**:
- Adding `NOT_IN` as a new enum value: Included in scope as it's the natural counterpart to `IN` and requires no data-model migration.

---

## Decision 3: Freetext input on choice options

**Decision**: Add `optionConfigs?: Array<{ label: string; freetextEnabled: boolean; freetextType: 'string' | 'number' }> | null` to `SurveyQuestion` and `SurveyQuestionInput`. Extend `SurveyAnswer` with `freetextValues?: Record<string, string>` to capture the freetext text value per selected option label.

**Rationale**:
- Keeping `options: string[]` as the canonical label list maintains backward compatibility for all existing surveys and consumers.
- `optionConfigs` is parallel to `options` and indexed by label (not position), making it safe to add/remove options without shifting freetext config.
- Using the option label as the `freetextValues` key is safe since options within a question must be unique.
- Storing freetext in `SurveyAnswer.freetextValues` keeps the existing `value` field unchanged — multi-choice answers still use `string[]` for selected labels.

**Alternatives considered**:
- Replace `options: string[]` with `options: ChoiceOptionConfig[]` (fully typed): Rejected — would break every consumer that reads option labels as strings (backend validation, response export, visibility condition comparison).
- Separate question type `SINGLE_CHOICE_WITH_FREETEXT`: Rejected — unnecessary proliferation of question types when the capability is additive to existing types.

---

## Decision 4: Review spaces filter — data source

**Decision**: The `ReviewQueueView` scope selector currently uses `user.memberships` (spaces where the researcher is a member). Replace this with a call to the existing `groups.list()` API endpoint (`GET /api/admin/groups`) which returns all groups in the system. The researcher must have the `review:read` permission to see the review queue anyway, so all groups should be visible to them.

**Rationale**:
- `adminApi.groups.list()` already exists in `workbench-frontend/src/services/adminApi.ts` and returns `GroupDto[]`.
- The chat list (which the user references) uses the same endpoint to populate its space list.
- Fetching on mount with a loading state keeps the pattern consistent with other list views.
- No backend changes required.

**Alternatives considered**:
- Use `user.memberships` but include all statuses (not just active): Rejected — researchers may have access to review spaces they are not members of.
- Add a new `GET /api/review/groups` endpoint: Rejected — the existing admin groups endpoint already serves this purpose and is already secured.

---

## Decision 5: Visibility priority over required — status

**Decision**: No new code changes required. The backend (`surveyResponse.service.ts`) already correctly skips required validation for hidden questions (visibility map evaluated first; `if (!isVisible) continue` guards the required check). The frontend (`SurveyForm.tsx`) also correctly skips validation since `visibleQuestions` excludes hidden questions from the progression flow.

**Rationale**: Code audit confirmed correct implementation in both frontend and backend paths. Tests should be added to formally document and guard this invariant, since it was not previously tested explicitly.

**Alternatives considered**: None — existing implementation is correct.

---

## Decision 6: `NOT_IN` operator addition

**Decision**: Add `NOT_IN = 'not_in'` to `VisibilityConditionOperator` enum in `chat-types` to complement `IN`. Backend validation and `evaluateVisibility` updated accordingly.

**Rationale**: The `EQUALS`/`NOT_EQUALS` pair already exists. Adding `IN`/`NOT_IN` as a pair is consistent, enables "show unless any of" conditions, and requires only minor additions.

---

## Cross-repository execution order

1. **`chat-types`**: Type changes (new fields, new operator enum value, updated `evaluateVisibility`). Publish as minor version bump.
2. **`chat-backend`**: Update `buildQuestion`, `validateQuestionInput`, `surveyResponse.service.ts` to consume new types. Update `surveySchema.service.ts` schema validation.
3. **`workbench-frontend`**: Update `VisibilityConditionEditor`, `QuestionEditor`, `QuestionList`, `toEditorQuestions`, `ReviewQueueView`.
4. **`chat-frontend-common`**: Update `SingleChoiceInput`, `MultiChoiceInput` for freetext; update `evaluateVisibility` consumption in survey state.
5. **`chat-frontend`**: Update `surveyGateStore` for freetext answer handling and new visibility evaluation signature.
