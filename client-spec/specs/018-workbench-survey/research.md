# Research: Workbench Survey Module

**Branch**: `018-workbench-survey` | **Date**: 2026-03-03

## Research Items

### R1: JSONB Schema Storage vs. Relational Question Table

**Decision**: Embedded JSONB array in `survey_schemas.questions`

**Rationale**: Questions are always read and written as a complete ordered set with the schema. They have no independent lifecycle or cross-schema references. JSONB storage:
- Eliminates N+1 queries for question loading
- Makes snapshot creation trivial (deep-copy the whole schema row)
- Simplifies drag-to-reorder (update one JSONB column vs. N row updates)
- Matches the existing backend pattern (no ORM; raw SQL)

**Alternatives considered**:
- Separate `survey_questions` table with FK to schema: adds complexity to snapshot creation (must copy rows), reorder requires N updates, and questions are never queried independently.
- Hybrid (relational + JSONB snapshot): doubles storage without benefit since published schemas are immutable anyway.

**Trade-off**: JSONB makes individual question queries harder (e.g., "find all schemas with a riskFlag question"). Acceptable because such queries are not in MVP scope.

---

### R2: Schema Snapshot Strategy

**Decision**: Full deep-copy of `SurveySchema` record (all fields including questions) stored as `schemaSnapshot` JSONB on `SurveyInstance`.

**Rationale**: The spec requires zero data drift. Since schemas are immutable after publish, the snapshot is guaranteed identical to the live schema at instance creation time. Storing a full copy:
- Decouples instance rendering from the live schema entirely
- Survives schema archival/restoration without ambiguity
- Makes response validation self-contained (no JOINs to live schema)

**Alternatives considered**:
- Reference-only (JOIN to `survey_schemas` at read time): violates the spec's "no data drift" rule; if the schema could theoretically be restored and re-published (it can't in this lifecycle, but defense in depth)
- Storing only questions snapshot: insufficient; title, description, and metadata are also needed for gate display

---

### R3: Scheduled Job Implementation

**Decision**: `setInterval` in the backend process, matching the existing session expiry pattern.

**Rationale**: The backend already uses `setInterval` for `expireOldSessions()` (every 5 min) and notification retry polling (every 60s). Adding another interval-based job is consistent and requires zero infrastructure changes. The 60-second default poll interval is acceptable for survey status transitions (users won't notice a ≤60s delay in instance activation).

**Alternatives considered**:
- Cloud Scheduler calling a dedicated endpoint (like `POST /api/admin/sessions/expire`): production-grade but adds infrastructure work. Can be added later if needed.
- Event-driven triggers on `start_date`/`expiration_date`: complex; requires a scheduler service or database-level triggers. Over-engineered for MVP.

**Trade-off**: `setInterval` doesn't survive process restarts during the interval window (up to 60s gap). Acceptable since Cloud Run instances restart infrequently and the job is idempotent.

---

### R4: Drag-and-Drop Library for Question Reordering

**Decision**: `@dnd-kit/core` + `@dnd-kit/sortable`

**Rationale**: The workbench-frontend has no existing drag-and-drop library. `@dnd-kit` is:
- The most actively maintained React DnD library (successor to react-beautiful-dnd)
- Lightweight, tree-shakeable, built for React 18
- Supports keyboard accessibility (WCAG AA compliance per Constitution VI)
- Touch-friendly for tablet use (responsive requirement)

**Alternatives considered**:
- `react-beautiful-dnd`: deprecated/unmaintained by Atlassian since 2024
- `react-dnd`: lower-level, requires more boilerplate, weaker accessibility defaults
- Native HTML5 drag-and-drop: no keyboard support, poor mobile/touch support

---

### R5: Permission Model for Survey Operations

**Decision**: Add new permissions to the existing `Permission` enum in `chat-types`. Map to existing roles via the RBAC layer.

**New permissions**:
| Permission | Roles |
|---|---|
| `SURVEY_SCHEMA_MANAGE` | Researcher, Admin |
| `SURVEY_INSTANCE_MANAGE` | Researcher, Admin |
| `SURVEY_INSTANCE_VIEW` | Researcher, Admin, Supervisor |
| `SURVEY_SCHEMA_ARCHIVE` | Admin |
| `SURVEY_RESPONSE_VIEW` | Researcher, Admin |

**Rationale**: Fine-grained permissions allow future role adjustments without code changes. Matches the existing `requirePermission()` middleware pattern. No new roles needed per spec.

**Alternatives considered**:
- Reusing existing permissions (e.g., `WORKBENCH_ACCESS`): too coarse; Supervisors need `SURVEY_INSTANCE_VIEW` but not `SURVEY_SCHEMA_MANAGE`.
- Role-based checks instead of permission-based: the codebase uses permission-based checks throughout; switching to role-based would be inconsistent.

---

### R6: Gate-Check Query Strategy

**Decision**: Single query with GIN index on `group_ids` + subquery for completed responses.

```sql
SELECT si.* FROM survey_instances si
WHERE si.status = 'active'
  AND si.group_ids && $1  -- array overlap with user's group IDs
  AND NOT EXISTS (
    SELECT 1 FROM survey_responses sr
    WHERE sr.instance_id = si.id
      AND sr.pseudonymous_id = $2
      AND sr.is_complete = true
  )
ORDER BY si.priority ASC, si.start_date ASC;
```

**Rationale**: The GIN index on `group_ids` makes array overlap (`&&`) efficient. The `NOT EXISTS` subquery uses the existing unique index on `(instance_id, pseudonymous_id)`. This returns the ordered list of pending surveys in one round-trip.

**Alternatives considered**:
- Application-level filtering (fetch all active instances, then filter): wastes bandwidth and shifts work to the application layer
- Materialized view: unnecessary for the expected data volume (dozens to hundreds of instances, not millions)

---

### R7: Partial Response Save Strategy

**Decision**: Auto-save on each "Next" navigation via `PATCH /api/chat/survey-responses/:id`. The response record is created on first interaction (`POST`), then updated on each step. `isComplete` remains `false` until final submission.

**Rationale**: Matches the spec requirement for partial progress persistence. The `UNIQUE (instance_id, pseudonymous_id)` constraint prevents duplicate responses. Last-write-wins semantics (per clarification) mean no version checking is needed on PATCH.

**Alternatives considered**:
- Client-side only storage (localStorage): lost on device switch or cache clear; unacceptable for this population
- Debounced auto-save: adds complexity; question-level save on Next is sufficient granularity

---

### R8: Survey Gate Integration Point in Chat Frontend

**Decision**: Insert `SurveyGate` component between `ProtectedRoute` and `ChatShell` in the chat route hierarchy.

```
App (Routes)
  └── ProtectedRoute (auth gate)
        └── SurveyGate (new — blocks if pending surveys)
              └── ChatShell
                    └── ChatInterface
```

**Rationale**: The gate check runs after authentication (need user identity to resolve groups and pseudonymous ID) but before chat session initialization (which is an expensive Dialogflow CX call). `SurveyGate` calls `GET /api/chat/gate-check` on mount:
- If pending surveys: renders survey form full-screen
- If no pending surveys: renders children (`ChatShell`)

**Alternatives considered**:
- Gate as a modal overlay inside `ChatInterface`: complicates the chat lifecycle; session would start before surveys are complete
- Separate route (`/survey`): requires redirect logic and URL management; inline gate is simpler

---

### R9: i18n Strategy for Survey Content

**Decision**: Survey question text and options are stored in the authored language (Ukrainian in practice). No automated translation in MVP.

**Rationale**: The spec explicitly states "Multi-language question text beyond what is authored manually" is out of scope. Researchers author questions in the target language. The survey UI chrome (buttons, labels, progress indicator) uses the existing i18n infrastructure (`i18next` with `uk.json`, `en.json`, `ru.json` locale files).

**New i18n keys needed**: Survey-related UI labels (Next, Back, Submit, "Question X of N", gate title, loading states) added to all three locale files in both `chat-frontend` and `workbench-frontend`.

---

### R10: Invalidation Model (Instance / Group / Individual)

**Decision**: Support invalidation at three scopes in MVP:
- **Instance-wide**: invalidate all responses for a `SurveyInstance`
- **Group-scope**: invalidate all responses for a specific `groupId` within the instance
- **Individual**: invalidate a single `SurveyResponse`

**Rationale**: Researchers need to correct bad deployments and/or data quality problems without deleting data. Keeping responses but marking them invalidated preserves auditability while allowing reporting, completion counts, and memory to exclude invalid data.

**Key design choices**:
- Persist invalidation markers on `survey_responses` (`invalidated_at`, `invalidated_by`, optional `invalidation_reason`).
- Gate-check treats a response as satisfying completion only if `is_complete = true AND invalidated_at IS NULL`.
- Group-scope invalidation requires recording the specific `group_id` context on each response to disambiguate users who belong to multiple groups.

**Alternatives considered**:
- Hard-delete invalid responses: violates auditability and makes “why did this change” unclear.
- Store invalidation events in a separate table only: makes queries for “valid responses” harder and increases join complexity for every list/count.

---

### R11: “Add to Memory” Integration

**Decision**: Instance-level toggle `add_to_memory` (default off). When enabled, completion triggers an **asynchronous** memory update using the existing agent-memory storage mechanism (GCS-backed system messages).

**Memory payload**:
- A **canonical/deterministic human-readable summary text** derived from `schema_snapshot` + answers.
- Stored replace-only per `(pseudonymousId, instanceId)` semantics by embedding stable identifiers in the message meta/content (e.g., `meta.kind='survey'`, `meta.instanceId`, `meta.schemaId`).

**Rationale**: Memory is already modeled as a bounded array of system messages persisted per principal. Adding a deterministic “survey summary” message fits the existing pattern and avoids LLM dependency for survey memory. Replace-only avoids duplicate or conflicting facts.

**Invalidation behavior**:
- When invalidating responses (instance/group/individual), asynchronously remove the corresponding survey-memory message(s) that match the invalidated response scope.
- If the user re-takes the survey after invalidation, the memory message is re-created/updated (replaced).

**Alternatives considered**:
- Use LLM consolidator for survey→memory: increases cost and adds nondeterminism (“no ambiguity” requirement is harder).
- Store memory in DB: diverges from the existing GCS memory store and complicates retrieval/injection.

---

### R12: Status Transitions in Cloud Run (Scale-to-Zero)

**Decision**: Hybrid approach:
- Keep the idempotent interval job for steady-state environments.
- Additionally run the same `draft→active` and `active→expired` transitions **inline** at the start of `GET /api/chat/gate-check` (and optionally on Workbench instance list/detail reads) to self-heal when Cloud Run scales to zero.

**Rationale**: Cloud Run often scales to zero, making background timers unreliable. Gate-check is a high-signal, user-path request that naturally “wakes” the service and is safe to piggyback with idempotent updates.

**Alternatives considered**:
- Cloud Scheduler calling an admin endpoint: robust but adds infra work; can still be layered later.

---

### R13: Survey Wizard Review Step

**Decision**: Add a final **Review** step before Submit in the chat survey wizard. Users can jump back to any question to edit answers and return to Review.

**Rationale**: This improves correctness and user confidence on longer instruments (25–67 questions) without enabling full random navigation throughout the survey. It is easy to validate and aligns with “no data loss + resume” requirements.
