# Data Model: 021-survey-schema-tools

**Branch**: `021-survey-schema-tools` | **Date**: 2026-03-05

---

## Existing Entities (No Changes)

### SurveySchema

No structural changes. Autosave uses the existing PATCH endpoint. The `updatedAt` field is used for conflict detection.

### SurveyQuestion (embedded JSONB)

No structural changes. All existing fields (`id`, `order`, `type`, `text`, `required`, `options`, `validation`, `ratingScaleConfig`, `visibilityCondition`, `riskFlag`) are preserved in the export format.

---

## New Types

### SchemaExportFormat

A portable JSON document for schema import/export. Not a database entity — it is the file format contract.

```typescript
interface SchemaExportFormat {
  schemaVersion: number;       // starts at 1; incremented on breaking format changes
  title: string;               // schema title (max 200)
  description: string | null;  // schema description (max 1000)
  questions: ExportQuestion[]; // ordered array of questions
}
```

### ExportQuestion

A question definition within the export format. Maps 1:1 to `SurveyQuestion` but uses only portable fields.

```typescript
interface ExportQuestion {
  id: string;                              // stable UUID, preserved for condition references
  order: number;                           // 1-based, contiguous
  type: SurveyQuestionType;                // canonical question type enum
  text: string;                            // question text (max 500)
  required: boolean;                       // default true
  options: string[] | null;                // for single_choice / multi_choice
  validation: {                            // for free_text only
    regex?: string | null;
    minLength?: number | null;
    maxLength?: number | null;
  } | null;
  ratingScaleConfig: {                     // for rating_scale only
    startValue: number;
    endValue: number;
    step: number;
  } | null;
  visibilityCondition: {                   // optional conditional visibility
    questionId: string;                    // references another question's id (lower order)
    operator: VisibilityConditionOperator; // equals | not_equals | in | contains
    value: string | string[] | boolean;
  } | null;
  riskFlag: boolean;                       // default false
}
```

### SaveStatus (UI state enum)

Client-side state for the autosave indicator. Not persisted.

```typescript
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
```

---

## Type Placement

| Type | Repository | File |
|------|-----------|------|
| `SchemaExportFormat` | `chat-types` | `src/survey.ts` |
| `ExportQuestion` | `chat-types` | `src/survey.ts` |
| `SaveStatus` | `workbench-frontend` | `src/features/workbench/surveys/types.ts` (local UI type) |

---

## Relationships

```
SchemaExportFormat
  └── questions: ExportQuestion[]
        └── visibilityCondition.questionId → ExportQuestion.id (same array, lower order)

SurveySchema (existing)
  ├── export → SchemaExportFormat (strip server fields, preserve question IDs)
  └── import ← SchemaExportFormat (create new SurveySchema draft, new schema ID, reuse question IDs)
```

---

## Mapping Rules

### Export: SurveySchema → SchemaExportFormat

| SurveySchema field | Exported | Notes |
|-------------------|----------|-------|
| `id` | No | Server-internal |
| `title` | Yes | |
| `description` | Yes | |
| `status` | No | Server-internal |
| `questions` | Yes | Each question mapped to ExportQuestion |
| `questions[].id` | Yes | Preserved for condition references |
| `clonedFromId` | No | Server-internal |
| `createdBy` | No | Server-internal |
| `createdAt` | No | Server-internal |
| `publishedAt` | No | Server-internal |
| `archivedAt` | No | Server-internal |
| `updatedAt` | No | Server-internal |
| (added) `schemaVersion` | Yes | Set to `1` |

### Import: SchemaExportFormat → SurveySchema

| SchemaExportFormat field | Target | Notes |
|-------------------------|--------|-------|
| `schemaVersion` | Validated | Must be ≤ current supported version |
| `title` | `SurveySchema.title` | |
| `description` | `SurveySchema.description` | |
| `questions` | `SurveySchema.questions` | Question IDs preserved from file |
| (generated) | `SurveySchema.id` | New UUID generated server-side |
| (generated) | `SurveySchema.status` | Set to `draft` |
| (generated) | `SurveySchema.createdBy` | Set to importing user |
| (generated) | `SurveySchema.createdAt` | Set to `now()` |
