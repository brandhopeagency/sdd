# Data Model: Survey Advanced Features

**Branch**: `022-survey-advanced-features`
**Date**: 2026-03-06

---

## Changed Types (`chat-types`)

### `VisibilityConditionOperator` (enum — extended)

```typescript
export enum VisibilityConditionOperator {
  EQUALS    = 'equals',
  NOT_EQUALS = 'not_equals',
  IN        = 'in',           // existing
  NOT_IN    = 'not_in',       // NEW
  CONTAINS  = 'contains',
}
```

### `VisibilityCondition` (unchanged)

```typescript
export interface VisibilityCondition {
  questionId: string;
  operator: VisibilityConditionOperator;
  value: string | string[] | boolean;   // array = multi-value; already supported
}
```

**Note**: `value` as `string[]` is already supported by the `IN` operator. The UI change enables entering multiple values in the editor.

### `ChoiceOptionConfig` (NEW)

```typescript
export interface ChoiceOptionConfig {
  label: string;               // must match the corresponding entry in options[]
  freetextEnabled: boolean;    // whether this option has an inline text input
  freetextType: 'string' | 'number';  // input validation type for freetext
  freetextRequired?: boolean;  // if true, freetext must be non-empty when option is selected
}
```

### `SurveyQuestion` (extended)

```typescript
export interface SurveyQuestion {
  id: string;
  order: number;
  type: SurveyQuestionType;
  text: string;
  required: boolean;
  options: string[] | null;
  validation: SurveyQuestionValidation | null;
  riskFlag: boolean;
  dataType?: FreeTextDataType;                          // deprecated
  ratingScaleConfig?: RatingScaleConfig | null;

  // Existing single-condition — deprecated, preserved for backward compat
  /** @deprecated Use visibilityConditions instead */
  visibilityCondition?: VisibilityCondition | null;

  // NEW: multi-condition visibility
  visibilityConditions?: VisibilityCondition[] | null;
  visibilityConditionCombinator?: 'and' | 'or' | null;  // defaults to 'and' when omitted

  // NEW: per-option freetext configuration (for single_choice / multi_choice only)
  optionConfigs?: ChoiceOptionConfig[] | null;
}
```

### `SurveyQuestionInput` (extended)

Mirrors `SurveyQuestion` changes for the schema editor write path:

```typescript
export interface SurveyQuestionInput {
  type: SurveyQuestionType;
  text: string;
  required?: boolean;
  options?: string[] | null;
  validation?: SurveyQuestionValidation | null;
  riskFlag?: boolean;
  dataType?: FreeTextDataType;
  ratingScaleConfig?: RatingScaleConfig | null;

  /** @deprecated Use visibilityConditions instead */
  visibilityCondition?: VisibilityCondition | null;

  visibilityConditions?: VisibilityCondition[] | null;
  visibilityConditionCombinator?: 'and' | 'or' | null;
  optionConfigs?: ChoiceOptionConfig[] | null;
}
```

### `SurveyAnswer` (extended)

```typescript
export interface SurveyAnswer {
  questionId: string;
  value: string | string[] | boolean | null;
  visible?: boolean;

  // NEW: captures freetext entry per selected option label
  // key = option label, value = freetext entered by respondent
  freetextValues?: Record<string, string> | null;
}
```

### `evaluateVisibility` (updated signature — backward-compatible)

The function signature is unchanged. The implementation is updated to support the new multi-condition model:

```
if visibilityConditions is present and non-empty:
  evaluate each condition against current answers
  combine results with combinator (and = all must be true, or = at least one)
  if source question is hidden → that condition evaluates to false
else if visibilityCondition is present (legacy):
  evaluate single condition as before
else:
  visible = true (unconditional)
```

---

## Database Impact

### `survey_schemas.questions` (JSONB column)

No migration required. The JSONB column accepts the extended fields as additive changes:
- New schemas will write `visibilityConditions` + `visibilityConditionCombinator` + `optionConfigs`.
- Existing schemas continue to work with the legacy `visibilityCondition` field.
- Survey instance snapshots (`survey_responses.answers`) stored for historical responses are unaffected.

### `survey_responses.answers` (JSONB column)

No migration required. `freetextValues` is an optional extension to the existing answer objects. Historical responses without it continue to parse correctly.

---

## Validation Rules (backend)

### Schema validation additions

- `visibilityConditions`: if provided, each entry must be a valid `VisibilityCondition` object; `questionId` must reference a question with a lower `order` (no forward references).
- `visibilityConditionCombinator`: if `visibilityConditions` is non-empty, combinator must be `'and'` or `'or'`; defaults to `'and'` when absent.
- `optionConfigs`: if provided, each `label` must exactly match an entry in `options[]`; only allowed on `single_choice` and `multi_choice` question types.

### Answer validation additions

- `freetextValues`: if provided, each key must match a selected option label; values must conform to `freetextType` (`'number'` type rejects non-numeric strings).
- A freetext option that `freetextRequired` is true (when implemented) must have a non-empty value in `freetextValues` when that option is selected.

---

## Schema Export/Import Format (updated)

`ExportQuestion` gains the same new fields as `SurveyQuestion`:

```typescript
export interface ExportQuestion {
  // ... existing fields ...
  visibilityConditions?: VisibilityCondition[] | null;
  visibilityConditionCombinator?: 'and' | 'or' | null;
  optionConfigs?: ChoiceOptionConfig[] | null;
}
```

Export version bumped to `2`.

---

## Groups / Spaces (no data model change)

The `GroupDto` in `workbench-frontend/src/services/adminApi.ts` is reused as-is. The `ReviewQueueView` scope filter loads all groups via `groups.list()` instead of from `user.memberships`.
