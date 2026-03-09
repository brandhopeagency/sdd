# Data Model: Survey Module Enhancements

**Branch**: `019-survey-question-enhancements` | **Date**: 2026-03-05  
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

---

## Overview

This model finalizes:
- Canonical `SurveyQuestion.type` values for typed questions
- Type-specific constraints only where semantically valid
- Conditional visibility state persisted via `SurveyAnswer.visible`
- Per-group survey ordering with `group_survey_order`
- Instance UX flags (`public_header`, `show_review`)
- Per-invite admission policy (`requires_approval`)

---

## Core Entities

### 1) SurveyQuestion (JSONB in schema + snapshot)

```ts
type SurveyQuestionType =
  | 'free_text'
  | 'integer_signed'
  | 'integer_unsigned'
  | 'decimal'
  | 'date'
  | 'time'
  | 'datetime'
  | 'email'
  | 'phone'
  | 'url'
  | 'postal_code'
  | 'alphanumeric_code'
  | 'rating_scale'
  | 'single_choice'
  | 'multi_choice'
  | 'boolean';

interface SurveyQuestion {
  id: string;
  order: number;
  text: string;
  type: SurveyQuestionType;
  required?: boolean;
  validation?: {
    regex?: string;       // free_text only
    minLength?: number;   // free_text only
    maxLength?: number;   // free_text only
    minValue?: number;    // numeric only
    maxValue?: number;    // numeric only
    min?: string;         // date/time/datetime only
    max?: string;         // date/time/datetime only
  };
  ratingScaleConfig?: {
    startValue: number;
    endValue: number;
    step: number;
  }; // required for rating_scale
  visibilityCondition?: {
    questionId: string;
    operator: 'equals' | 'not_equals' | 'in' | 'contains';
    value: string | string[] | boolean;
  };
}
```

Validation rules:
- `rating_scale`: `endValue > startValue`, `step > 0`, segment count integral
- `validation.regex` cannot be set on preset/non-free-text types
- `minValue/maxValue` only for numeric question types
- `min/max` only for date/time/datetime question types
- `visibilityCondition.questionId` must reference lower-order question

---

### 2) SurveyAnswer (JSONB in `survey_responses.answers`)

```ts
interface SurveyAnswer {
  questionId: string;
  value: string | string[] | boolean | null;
  visible?: boolean; // default true for legacy responses
}
```

State semantics:
- shown and answered: `visible: true`, non-null value
- shown and blank optional: `visible: true`, null value
- hidden by condition: `visible: false`, null value

---

### 3) SurveyInstance (`survey_instances` table)

Added fields:
- `public_header VARCHAR(300) NULL`
- `show_review BOOLEAN NOT NULL DEFAULT true`

Removed field:
- `priority` (replaced by per-group ordering table)

---

### 4) GroupSurveyOrder (`group_survey_order` table)

```sql
CREATE TABLE group_survey_order (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL,
  instance_id   UUID NOT NULL REFERENCES survey_instances(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, instance_id)
);
```

Behavior:
- one row per `(group_id, instance_id)`
- newly assigned surveys appended to end
- drag-drop updates `display_order`

---

### 5) InvitationCode (`group_invite_codes` / invite table)

Added field:
- `requires_approval BOOLEAN NOT NULL DEFAULT true`

State transition effect:
- `requires_approval = false` -> membership auto-activates and user status transitions to active
- `requires_approval = true` -> existing pending approval workflow

---

## Relationships

```text
SurveySchema (JSONB questions)
  -> SurveyInstance (schema_snapshot, public_header, show_review)
    -> GroupSurveyOrder (group scoped ordering)
    -> SurveyResponse (answers with visible flag)

Group
  -> GroupSurveyOrder
  -> InvitationCode (requires_approval)
```

---

## Backward Compatibility Contracts

- Legacy question docs without new fields remain valid
- Legacy answers without `visible` are treated as visible
- Existing answer value union remains unchanged
- Snapshot reader must tolerate absent optional properties
