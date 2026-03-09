# API Contract Changes: Survey Module Enhancements

**Branch**: `019-survey-question-enhancements` | **Date**: 2026-03-05

---

## Overview

This enhancement keeps route surface mostly stable, with new/updated contracts for:
- group-scoped survey ordering endpoints
- grouped export endpoint
- schema payload using canonical `question.type` semantics
- instance UX metadata and invite auto-admit behavior

---

## New Endpoints

### 1. `GET /api/workbench/groups/:groupId/surveys` — List Group Survey Instances

Lists all survey instances assigned to the specified group, ordered by `group_survey_order.display_order`.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "instanceId": "uuid",
      "title": "Pre-Session Intake",
      "publicHeader": "Wellness Check",
      "status": "active",
      "displayOrder": 1,
      "startDate": "2026-03-01T00:00:00Z",
      "expirationDate": "2026-06-01T00:00:00Z",
      "completedCount": 42,
      "showReview": true
    }
  ]
}
```

**Authorization**:
- route requires `SURVEY_INSTANCE_MANAGE`
- UI tab visibility mirrors permission (tab hidden for unauthorized users)

---

### 2. `PUT /api/workbench/groups/:groupId/surveys/order` — Update Group Survey Order

Accepts an ordered array of instance IDs and persists the new display order.

**Request**:
```json
{
  "instanceIds": ["uuid-1", "uuid-3", "uuid-2"]
}
```

**Validation**: All IDs must be valid instances assigned to the group. Returns 422 if any ID is missing or not assigned.

**Authorization**: `SURVEY_INSTANCE_MANAGE`

---

### 3. `GET /api/workbench/survey-instances/:instanceId/responses/download` — Bulk Download Responses

Downloads survey responses for an instance, scoped to a group.

**Query parameters**:
- `groupId` (required) — scope to this group's responses only
- `format` (required) — `json` or `csv`

**Response**: File download (Content-Disposition: attachment)
- **JSON**: Array of response objects with `pseudonymousId`, `answers[]` (including `visible` field), `completedAt`, `groupId`
- **CSV**: One row per response; columns: `pseudonymousId`, `completedAt`, then one column per question (header = question text), plus a `_visible` suffix column per question

**Authorization**: `SURVEY_INSTANCE_MANAGE`

---

## Modified Endpoints

### 4. `POST /api/workbench/survey-schemas` and `PATCH /api/workbench/survey-schemas/:id`

**Request body changes**: `questions[]` items now use canonical `type` for typed question kinds:
- `type`: `free_text | integer_signed | integer_unsigned | decimal | date | time | datetime | email | phone | url | postal_code | alphanumeric_code | rating_scale | ...existing types`
- `ratingScaleConfig` — `{ startValue, endValue, step }` required when `type` is `rating_scale`
- `visibilityCondition` — optional `{ questionId, operator, value }`
- `validation` supports type-specific constraints:
  - numeric: `minValue`, `maxValue`
  - date/time/datetime: `min`, `max`
  - free_text: `regex`, `minLength`, `maxLength`

**New validation**:
- `ratingScaleConfig`: `endValue > startValue`, `step > 0`, `(endValue - startValue) / step` is integer
- `visibilityCondition.questionId`: must reference lower-order question in same schema
- Constraint fields rejected when incompatible with selected `type`

---

### 5. `POST /api/workbench/survey-instances` — Create Instance

**Request body changes** (new optional fields):
```json
{
  "schemaId": "uuid",
  "groupIds": ["uuid"],
  "startDate": "...",
  "expirationDate": "...",
  "publicHeader": "Custom User-Facing Title",
  "showReview": false,
  "addToMemory": false
}
```

**Note**: `priority` field is no longer accepted. Group ordering is managed via the Group Surveys page.

**Side effect**: On successful creation, auto-inserts `group_survey_order` rows for each `groupId` with `displayOrder` at end of each group's list.

---

### 6. `POST /api/chat/survey-responses` — Submit Response

**New server-side validation on `isComplete: true`**:
1. Evaluate `visibilityCondition` for each question against submitted answers
2. Validate answer values by canonical `question.type` and type-specific constraints
3. Set `visible: false, value: null` for hidden questions
4. Exclude hidden required questions from completeness check

**Response**: `answers[]` includes `visible` field on each entry.

---

### 7. `GET /api/chat/gate-check` — Check Survey Gate

**Changed ordering logic**: Instead of `priority ASC, start_date ASC`, the gate now orders pending surveys by:
1. Active group's `group_survey_order.display_order ASC` first
2. Other groups alphabetically by group name, each using their `display_order ASC`

**Response changes**: `PendingSurvey.instance` includes `publicHeader` and `showReview`. Gate UI uses these for heading and review-step behavior.

---

## Unchanged Endpoints

All other survey endpoints remain unchanged in structure:
- Schema CRUD (GET list/detail, publish, archive, restore, clone, delete)
- Instance CRUD (GET list/detail, close)
- Invalidation endpoints
- Response detail (GET own response, PATCH partial)
- Workbench response list
