# API Contract: Survey Schema Import

**Feature**: 021-survey-schema-tools  
**Date**: 2026-03-05

---

## New Endpoint

### `POST /api/workbench/survey-schemas/import`

Creates a new draft survey schema from an imported JSON payload.

**Roles**: Researcher, Admin, Supervisor

**Request Body** (`application/json`):

```json
{
  "schemaVersion": 1,
  "title": "Pre-Session Intake Questionnaire",
  "description": "25-question intake form",
  "questions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "order": 1,
      "type": "integer_unsigned",
      "text": "What is your age?",
      "required": true,
      "options": null,
      "validation": null,
      "ratingScaleConfig": null,
      "visibilityCondition": null,
      "riskFlag": false
    }
  ]
}
```

**Validation Rules**:

| Rule | Error |
|------|-------|
| `schemaVersion` > current supported version | `422` — Version incompatibility |
| `schemaVersion` missing or non-numeric | `422` — Missing or invalid schemaVersion |
| `title` missing or empty | `422` — Title is required |
| `title` exceeds 200 characters | `422` — Title exceeds maximum length |
| `questions` missing or not an array | `422` — Questions array is required |
| Question with unsupported `type` | `422` — Unsupported question type: `{type}` |
| `visibilityCondition.questionId` references non-existent question ID | `422` — Visibility condition references unknown question ID: `{id}` |
| `visibilityCondition.questionId` references a question with equal or higher order | `422` — Visibility condition must reference an earlier question |
| `single_choice` / `multi_choice` without options | `422` — Options required for `{type}` |
| `rating_scale` without `ratingScaleConfig` | `422` — Rating scale config required for rating_scale type |
| Any other question validation failure | `422` — uses existing `validateQuestionInput` rules |

**Success Response** (`201 Created`):

```json
{
  "id": "new-uuid",
  "title": "Pre-Session Intake Questionnaire",
  "description": "25-question intake form",
  "status": "draft",
  "questions": [...],
  "createdBy": "importing-user-uuid",
  "createdAt": "2026-03-05T12:00:00Z",
  "updatedAt": "2026-03-05T12:00:00Z",
  "clonedFromId": null,
  "publishedAt": null,
  "archivedAt": null
}
```

**Error Response** (`422 Unprocessable Entity`):

```json
{
  "error": "Import validation failed",
  "details": [
    {
      "field": "questions[2].visibilityCondition.questionId",
      "message": "Visibility condition references unknown question ID: abc-123"
    },
    {
      "field": "questions[5].type",
      "message": "Unsupported question type: slider"
    }
  ]
}
```

**Notes**:

- The endpoint reuses `validateQuestionInput` and `validateVisibilityConditions` from `surveySchema.service.ts`.
- Question IDs from the import file are preserved (not regenerated).
- A new schema-level UUID is generated server-side.
- `createdBy` is set to the authenticated user.
- `status` is always `draft`.
- No link to original schema (`clonedFromId` is null).
- All validation errors are collected and returned together (not fail-fast).

---

## Existing Endpoints (No Changes)

The following endpoints are used as-is by the new features:

| Endpoint | Used By | Notes |
|----------|---------|-------|
| `PATCH /api/workbench/survey-schemas/:id` | Autosave | Existing; debounced calls from client |
| `GET /api/workbench/survey-schemas/:id` | Export, Preview | Existing; loads schema data |
| `GET /api/workbench/survey-schemas` | Import (list page) | Existing; schema list where Import button lives |

---

## RBAC Summary

| Action | Endpoint | Researcher | Admin | Supervisor |
|--------|----------|------------|-------|------------|
| Autosave (edit draft) | `PATCH /:id` | Yes | Yes | Yes |
| Preview | Client-side (no endpoint) | Yes | Yes | Yes |
| Export | Client-side (no endpoint) | Yes | Yes | Yes |
| Import | `POST /import` | Yes | Yes | Yes |
