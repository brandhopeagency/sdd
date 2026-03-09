# Research: 021-survey-schema-tools

**Branch**: `021-survey-schema-tools` | **Date**: 2026-03-05

---

## R1: Autosave Strategy for Draft Schemas

### Decision

Use **client-side debounced autosave** that calls the existing `PATCH /api/workbench/survey-schemas/:id` endpoint. No backend changes needed for autosave itself.

### Rationale

- The existing PATCH endpoint already accepts partial updates (`title`, `description`, `questions`) and validates draft-only status (returns 403 for non-draft).
- Debounced autosave at 2 seconds after last edit is standard for editor UIs (Google Docs, Notion, Figma).
- The `surveyStore.ts` in workbench-frontend already manages schema state; adding a debounced save trigger requires minimal state management changes.
- The `handleSave` flow in `SurveySchemaEditorView.tsx` (line 100) already calls `updateSchema(id, { title, description, questions })` → `surveySchemaApi.update()` → PATCH. Autosave reuses this exact path.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| WebSocket-based real-time sync | Overengineered for single-user draft editing; "no collaborative real-time editing" is explicitly out of scope |
| Local-only autosave (IndexedDB) then manual push | Users expect server persistence; local-only creates false sense of safety |
| Optimistic concurrency with ETag/version | Adds complexity; last-write-wins is the established pattern (018 MVP) |

### Implementation Notes

- Add a `useDebouncedSave` hook (or equivalent) in the workbench-frontend that triggers 2 seconds after the last state mutation.
- Save status tracked via a state enum: `idle | saving | saved | error`.
- `beforeunload` event listener warns when `status === 'saving'` or there are unmutated local changes.
- Conflict detection: Poll schema `updatedAt` on save response. If it differs from the locally tracked value, show a notification.

---

## R2: Preview Rendering — Component Reuse Strategy

### Decision

Extract pure question rendering components (`QuestionRenderer`, `FreeTextInput`, `SingleChoiceInput`, `MultiChoiceInput`, `BooleanInput`, `NumericInput`, `DateTimeInput`, `PresetTextInput`, `RatingScaleInput`, `SurveyProgress`) from `chat-frontend` into `@mentalhelpglobal/chat-frontend-common` as a shared `survey-ui` module. Both `chat-frontend` (gate) and `workbench-frontend` (preview) import from this shared source.

### Rationale

- The spec requires the preview to render "exactly as a user would see it in the gate" — same input controls, conditional visibility, progress indicator, and review step.
- Duplicating components across repos would create drift and maintenance burden.
- The constitution mandates: "Shared frontend code is published via `@mentalhelpglobal/chat-frontend-common` npm package."
- The extracted components are pure UI — they accept props (question, value, onChange) and render. No API/store dependencies need to move.
- `SurveyForm` (the navigation wrapper) can be extracted as well, parameterized to skip API calls in preview mode.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Build separate preview components in workbench-frontend | Violates DRY; drift risk; spec requires identical rendering |
| Import directly from chat-frontend | Not supported in split-repo architecture; repos are independent npm packages |
| Keep basic SchemaPreviewPanel as-is | Does not meet spec requirement for gate-style question-by-question flow |

### Implementation Notes

- Extract to `chat-frontend-common/src/survey-ui/` with its own barrel export.
- `SurveyForm` component gets an `onSubmit` prop (called in gate mode) and a `mode: 'gate' | 'preview'` prop that controls whether API calls are made.
- In preview mode: no `onSubmit`, no partial save API calls, no gate-check — purely local state.
- `evaluateVisibility` already lives in `chat-types` — no move needed.
- Chat-frontend updates imports to `@mentalhelpglobal/chat-frontend-common/survey-ui`.

---

## R3: Export Format Specification

### Decision

Export format is a self-contained JSON document with a `schemaVersion` field, schema metadata, and a complete questions array preserving stable question UUIDs.

### Rationale

- Question UUIDs are required for visibility condition references (clarification Q1).
- Excluding server-internal fields (schema-level ID, timestamps, createdBy) makes the format environment-independent.
- A `schemaVersion` field (starting at `1`) enables future format evolution with backward-compatible import validation.
- Export is entirely client-side — the browser constructs the JSON from the loaded schema state and triggers a download via `Blob` + `URL.createObjectURL`.

### Format

```json
{
  "schemaVersion": 1,
  "title": "Pre-Session Intake Questionnaire",
  "description": "25-question intake form for officers",
  "questions": [
    {
      "id": "uuid-1",
      "order": 1,
      "type": "integer_unsigned",
      "text": "What is your age?",
      "required": true,
      "options": null,
      "validation": null,
      "ratingScaleConfig": null,
      "visibilityCondition": null,
      "riskFlag": false
    },
    {
      "id": "uuid-2",
      "order": 2,
      "type": "single_choice",
      "text": "Gender",
      "required": true,
      "options": ["чоловік", "жінка"],
      "validation": null,
      "ratingScaleConfig": null,
      "visibilityCondition": null,
      "riskFlag": false
    }
  ]
}
```

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Include all server fields and strip on import | Export file contains sensitive metadata (createdBy UUID); unnecessarily large |
| Use a custom binary format | Not human-readable; harder to debug; JSON is the spec requirement |
| YAML format option | Adds a dependency; JSON is universal and the spec specifies JSON |

---

## R4: Import Validation — Client-Side vs Server-Side

### Decision

**Both**: Client-side validation for immediate feedback (file size, JSON syntax, basic structure), server-side validation via a dedicated `POST /api/workbench/survey-schemas/import` endpoint for authoritative schema/condition validation.

### Rationale

- Client-side catches obvious errors fast (bad JSON, too large, missing fields) without a round-trip.
- Server-side is required for authoritative validation: question type support, visibility condition reference integrity, and `schemaVersion` compatibility — this must not be bypassable.
- A dedicated import endpoint (separate from the generic POST create) allows import-specific validation logic (schemaVersion check, question ID preservation) without complicating the standard create flow.
- The backend already has `validateQuestionInput` and `validateVisibilityConditions` in `surveySchema.service.ts` — the import endpoint reuses these.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Client-side only validation + existing POST create | Validation is bypassable; no schemaVersion check on server; question IDs may conflict |
| Server-side only (upload file to server) | Slower feedback; unnecessary file storage; export is client-side so import should match |

### Implementation Notes

- Client-side: `FileReader` → `JSON.parse` → check `schemaVersion`, `title`, `questions` array presence. Show errors inline.
- Server-side: `POST /api/workbench/survey-schemas/import` accepts the parsed JSON body (not multipart file upload). Validates against `SurveyQuestionInput` types, checks condition references, creates draft. Returns the created schema or 422 with detailed errors.
- File size check (5 MB) is client-side only (before upload).

---

## R5: Conflict Detection for Concurrent Editors

### Decision

Use **`updatedAt` timestamp comparison** on each save. If the server's `updatedAt` on the save response differs from the client's last-known value, show a notification.

### Rationale

- The `SurveySchema` entity already has an `updatedAt` field that is updated on every PATCH.
- Comparing timestamps is simple and sufficient for the last-write-wins model.
- No backend changes needed — the PATCH response already includes `updatedAt`.

### Implementation Notes

- On successful PATCH response, compare `response.updatedAt` with the locally tracked `lastKnownUpdatedAt`.
- If they differ (meaning someone else saved between our load and our save), show a notification: "This schema was updated by another user. Reload to see their changes, or continue editing (your next save will overwrite)."
- Update `lastKnownUpdatedAt` to the response value after each save.
