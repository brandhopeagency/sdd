# API Contract Changes: Survey Schema Advanced Features

**Branch**: `022-survey-advanced-features`
**Date**: 2026-03-06

All existing survey schema endpoints remain at the same URLs. This document describes the schema changes to request/response payloads.

---

## `PATCH /api/survey/schemas/:id` — Request Body (extended)

### `questions[]` item (additive changes)

```jsonc
{
  "type": "single_choice",
  "text": "How do you feel today?",
  "required": true,
  "options": ["Great", "OK", "Other"],

  // NEW: multi-condition visibility (replaces visibilityCondition for new schemas)
  "visibilityConditions": [
    {
      "questionId": "29639a51-8634-4fe7-9f28-2183cfc19a2f",
      "operator": "equals",
      "value": "Yes"
    },
    {
      "questionId": "000ad221-eda7-4327-9c56-0201425f0411",
      "operator": "in",
      "value": ["Anxious", "Depressed"]   // multi-value
    }
  ],
  "visibilityConditionCombinator": "and",  // "and" | "or"

  // NEW: freetext configuration per option
  "optionConfigs": [
    { "label": "Other", "freetextEnabled": true, "freetextType": "string" }
  ]
}
```

**Backward compatibility**: `visibilityCondition` (singular) is still accepted. When the backend encounters a question with both `visibilityCondition` and `visibilityConditions`, `visibilityConditions` takes precedence.

---

## `GET /api/survey/schemas/:id` — Response (extended)

`SurveySchema.questions[]` items now include `visibilityConditions`, `visibilityConditionCombinator`, and `optionConfigs` fields when set.

---

## `POST /api/survey/responses` — Survey answer with freetext (extended)

### `answers[]` item (additive change)

```jsonc
{
  "questionId": "abc123",
  "value": ["Great", "Other"],   // multi-choice: selected option labels
  "freetextValues": {            // NEW: optional freetext per selected option
    "Other": "I feel quite tired"
  }
}
```

For `single_choice` answers:
```jsonc
{
  "questionId": "def456",
  "value": "Other",
  "freetextValues": {
    "Other": "25"    // numeric freetext stored as string
  }
}
```

---

## Validation Errors (new cases)

| Error | Status | Condition |
|-------|--------|-----------|
| `visibilityConditions references non-existent question` | 422 | Any `questionId` in `visibilityConditions` not found in schema |
| `visibilityConditions forward reference` | 422 | Any `questionId` references a question with equal or higher `order` |
| `optionConfigs label not in options` | 422 | A `label` in `optionConfigs` has no matching entry in `options[]` |
| `optionConfigs only valid for single_choice or multi_choice` | 422 | `optionConfigs` provided on incompatible question type |
| `freetextValues key not selected` | 422 | A key in `freetextValues` is not in the answer `value` |
| `freetextValues numeric validation` | 422 | A `number`-typed freetext value is non-numeric |

---

## New Operator

`VisibilityConditionOperator.NOT_IN = 'not_in'` is valid in `visibilityConditions[].operator`.

---

## No New Endpoints

All functionality is delivered via extensions to existing endpoints. No new routes are introduced.
