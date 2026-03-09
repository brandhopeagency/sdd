# Feature Specification: Workbench Survey Module

**Feature Branch**: `018-workbench-survey`  
**Created**: 2026-03-03  
**Status**: Draft  
**Jira Epic**: [MTB-405](https://mentalhelpglobal.atlassian.net/browse/MTB-405)  
**Depends on**: Existing `Group` entity, pseudonymous ID layer, RBAC model  
**Input**: User description: "MHG-SURV-001 · Workbench Survey Module"

---

## Problem Statement

Researchers need to collect structured psychometric and intake data from officers **before** those officers can access the chat interface. Currently this is done ad-hoc and manually. The Survey Module replaces this with a configurable, workbench-driven system that enforces strict data immutability, pseudonymity, and time-boxed deployment.

---

## Clarifications

### Session 2026-03-03

- Q: Should Researchers be able to view individual (pseudonymous) response answers, and if so, scoped to own instances or all? → A: Researchers and Admins can view individual pseudonymous responses for all instances.
- Q: Should users complete all pending surveys before chat per visit, or one per session? And what determines display order? → A: All pending surveys must be completed before chat access. Display order is controlled by a `priority` integer field on `SurveyInstance` (ascending; lower = shown first).
- Q: Should a minimum group size (e.g., ≥ 25 for k-anonymity) be enforced before a survey instance can be activated? → A: No minimum group size enforced. Any group can receive a survey instance.
- Q: Should `riskFlag: true` on questions (e.g., self-harm ideation) trigger any workbench notification in MVP, or remain store-only? → A: Store-only. `riskFlag` is metadata with no runtime behaviour in MVP; automation deferred to Phase 2.
- Q: How should concurrent partial saves from multiple tabs/devices be handled? → A: Last-write-wins. No conflict detection or optimistic locking in MVP.

### Session 2026-03-04

- Q: When survey results are invalidated from Workbench, should invalidation re-open the gate for affected users? → A: Yes — invalidation re-opens the gate for affected users while the instance is still active; invalidated results are excluded from counts/exports, related user memory is removed, and users must re-submit to regain “complete” state.
- Q: In the client survey wizard, should users be able to review answered questions before final submission? → A: Yes — show progress as current question number / total, and add a final “Review answers” step before Submit where users can jump back to any question, edit answers, then return to Review and submit.
- Q: Which invalidation scopes must be supported in MVP? → A: Support all three: invalidate all results for a survey instance, invalidate results for a specific group within an instance, and invalidate an individual response.
- Q: If surveys have an “Add to memory” option, how should memory updates be stored to avoid ambiguity/duplication? → A: Store a single canonical survey-memory payload per user per survey instance keyed by `(pseudonymousId, instanceId)`; updates are replace-only; invalidation removes that exact payload.
- Q: Where should the “Add to memory” setting live? → A: Instance-level setting (chosen per deployment).
- Q: What should be written to memory when “Add to memory” is enabled? → A: A human-readable survey summary text payload (canonical/deterministic format) to avoid ambiguity/duplication; replace-only per `(pseudonymousId, instanceId)`.

---

## Reference Instruments (Sample Requirements)

Two existing instruments define the question types and data patterns the module must support. These will be the first surveys authored once the module ships.

### Pre-Session Intake Questionnaire (`1_Остаточний_варіант_питань_ДО`)

25-question form administered before a user's first session. Mixes:

| # | Type (mapped to module) | Notes |
|---|---|---|
| 1 | `free_text` | Age — numeric, short |
| 2 | `single_choice` | Gender: чоловік / жінка |
| 3 | `single_choice` | Employment status (4 options) |
| 4 | `single_choice` | Marital status (5 options) |
| 5 | `single_choice` | Country of residence: Україна / Закордоном |
| 6 | `free_text` | Oblast — shown only if Q5 = Україна *(conditional — post-MVP)* |
| 7 | `boolean` | Experience with psychologist |
| 8 | `boolean` | Established psychiatric diagnosis |
| 9 | `free_text` | Diagnosis name + date — shown only if Q8 = yes *(conditional — post-MVP)* |
| 10 | `boolean` | Experience with psychiatric medication |
| 11 | `boolean` | Thoughts of self-harm / harm to others — **risk flag trigger** |
| 12–19 | `single_choice` (1–10 scale mapped as 10 options) | Emotional state, anxiety, worry, depression, irritability, attention, sleep, anhedonia — Likert 1–10 |
| 20 | `single_choice` (1–10 scale) | Internal resource availability |
| 21 | `single_choice` | AI app experience (3 options) |
| 22 | `single_choice` | Quality of AI experience (3 options) — shown only if Q21 ≠ ні *(conditional — post-MVP)* |
| 23 | `boolean` | Used AI for psychological support |
| 24 | `multi_choice` | What user wants from the Model (5 options + free text) |
| 25 | `free_text` | Open: what would you like to talk about today? |

> **MVP note:** Questions 6, 9, and 22 require conditional visibility (skip logic). Conditional logic is **out of scope for MVP**. These questions must still be authored in the schema; they will be shown unconditionally in MVP and flagged for post-MVP conditional rendering.

> **Risk note:** Q11 (self-harm ideation) must be identified in the schema as a risk-sensitive question. A `riskFlag: true` metadata field is reserved on `SurveyQuestion` for post-MVP integration with the workbench escalation pipeline. In MVP it is stored and surfaced to supervisors via raw response review only.

### Psychological Resourcefulness Questionnaire — Shtepa (ХАБ / `Діагностика_ХАБ`)

67-item instrument with a `boolean` (yes/no) response format. 15 scored subscales. Results are computed by keyed scoring (see table below). This instrument maps entirely to the `boolean` question type.

**Subscales and scoring keys (for reference; scoring computation is post-MVP):**

| Subscale | Yes keys | No keys |
|---|---|---|
| Впевненість у собі | 2, 3, 11, 55 | 9, 12, 21, 22 |
| Доброта до людей | 4, 5, 28 | 15, 16, 17, 26, 27 |
| Допомога іншим | 4, 6, 36, 37, 38 | 10, 17, 18 |
| Успіх | 1, 14, 29, 34, 40, 55 | 12, 42 |
| Любов | 11, 30, 51, 52, 53 | 7, 8, 33 |
| Творчість | 31, 37, 40, 53, 54 | 23, 24, 25 |
| Віра в добро | 1, 6, 28, 34, 35 | 7, 13, 16 |
| Прагнення до мудрості | 36, 39, 54, 55 | 33, 45, 46, 47 |
| Робота над собою | 11, 41, 52, 54 | 43, 48, 49, 50 |
| Самореалізація в професії | 11, 40, 53 | 23, 24, 42, 44, 47 |
| Відповідальність | 20, 32, 51, 52 | 8, 10, 19, 22 |
| Знання власних ресурсів | 60, 61, 67 | 57, 59, 62, 63, 66 |
| Уміння оновлювати ресурси | 56, 58, 60, 61 | 62, 63, 64, 66 |
| Уміння використовувати ресурси | 58, 61, 65, 67 | 59, 63, 64, 66 |
| Загальний рівень | sum of all subscale scores | — |

> **Scoring is out of scope for MVP.** Raw boolean responses per question are stored. A later phase will add computed subscale scores to `SurveyResponse`. The scoring key table above is captured here as a reference requirement for that phase.

---

## User Scenarios & Testing

### User Story 1 — Researcher Authors a Survey Schema (Priority: P1)

A researcher opens the Workbench, creates a new draft survey schema, adds typed questions (free text, single choice, multi choice, boolean), orders them, and publishes the schema. After publication the schema becomes immutable.

**Why this priority**: Without authored survey schemas, no surveys can be deployed. This is the foundational capability that enables all downstream workflows.

**Independent Test**: Can be fully tested by creating a schema in the Workbench, adding questions of each type, publishing, and confirming immutability — delivers a reusable, locked survey definition.

**Acceptance Scenarios**:

1. **Given** a researcher is on the schema list, **When** they click Create, **Then** a new draft schema with title and description fields appears.
2. **Given** a draft schema exists, **When** the researcher adds questions of each type and clicks Publish, **Then** the schema status becomes `published`, `publishedAt` is set, and all edit controls are disabled.
3. **Given** a published schema, **When** any actor attempts to modify it, **Then** the system returns a `403 Forbidden` error.
4. **Given** a draft schema with zero questions, **When** the researcher clicks Publish, **Then** the system blocks publication with a `422` error.

---

### User Story 2 — Researcher Deploys a Survey Instance (Priority: P1)

A researcher selects a published schema, assigns one or more groups, sets a start date and expiration date, and creates a survey instance. The instance automatically activates at the start date and expires at the expiration date.

**Why this priority**: Deployment of time-boxed, group-scoped survey instances is the mechanism by which researchers reach participants. Co-priority with schema authoring as both are required for end-to-end use.

**Independent Test**: Can be tested by creating an instance from a published schema with valid dates and groups, then verifying automatic status transitions occur on schedule.

**Acceptance Scenarios**:

1. **Given** a published schema and valid groups, **When** the researcher creates an instance with startDate and expirationDate, **Then** the instance is created with status `draft` and a frozen `schemaSnapshot`.
2. **Given** an instance in `draft` status, **When** `now() >= startDate`, **Then** the instance transitions to `active` automatically.
3. **Given** an active instance, **When** `now() >= expirationDate`, **Then** the instance transitions to `expired` automatically.
4. **Given** a non-published schema, **When** the researcher attempts to create an instance, **Then** the system returns `422`.
5. **Given** an instance creation request missing startDate or expirationDate, **When** submitted, **Then** the system returns `422`.
6. **Given** an instance where `expirationDate ≤ startDate`, **When** submitted, **Then** the system returns `422`.

---

### User Story 3 — Officer Completes Survey Gate Before Chat (Priority: P1)

An officer (user) opens the chat interface. If any active survey instances target the officer's group(s) and the officer has not completed them, a blocking survey gate appears. The officer completes the survey questions, submits, and then accesses the chat.

**Why this priority**: The survey gate is the core user-facing feature — it blocks chat access until surveys are completed, ensuring data collection happens before sessions.

**Independent Test**: Can be tested by assigning a survey to a group, logging in as a user in that group, verifying the gate blocks chat, completing the survey, and verifying chat becomes accessible.

**Acceptance Scenarios**:

1. **Given** a user in a group with an active unresponded survey, **When** they navigate to chat, **Then** the survey gate is displayed instead of the chat interface.
2. **Given** a user with all active surveys completed, **When** they navigate to chat, **Then** the chat loads normally.
3. **Given** a user is mid-survey and exits, **When** they return, **Then** partial answers are pre-filled and the gate resumes where they left off.
4. **Given** required questions are unanswered, **When** the user attempts to proceed, **Then** progression is blocked until required fields are filled.
5. **Given** a survey instance expires while the user is mid-response, **When** the user submits, **Then** the response is accepted (expiry applies to gate display, not in-flight submissions).
6. **Given** a user reaches the end of a survey, **When** they open the Review step, **Then** they can jump back to any question to revise answers and return to Review before final Submit.

---

### User Story 4 — Researcher Clones and Iterates on a Schema (Priority: P2)

A researcher wants to revise a published or archived survey. They clone the schema, receiving a new independent draft with all questions copied, make modifications, and publish the new version.

**Why this priority**: Clone-to-iterate is the versioning mechanism. Important for longitudinal studies but not required for first deployment.

**Independent Test**: Can be tested by cloning a published schema, verifying the new draft is independent, modifying it, and publishing — confirming no impact on the original.

**Acceptance Scenarios**:

1. **Given** a published or archived schema, **When** the researcher clicks Clone, **Then** a new draft schema is created with all questions copied and `clonedFromId` referencing the original.
2. **Given** a cloned draft, **When** the researcher modifies and publishes it, **Then** the original schema and any instances created from it remain unchanged.

---

### User Story 5 — Admin Archives and Restores Schemas (Priority: P2)

An admin archives a published schema that is no longer needed for new deployments. The schema disappears from the default list but existing instances remain active. Later, the admin restores it to draft for editing.

**Why this priority**: Administrative lifecycle management is needed for orderly schema governance but is not on the critical path for first survey deployment.

**Independent Test**: Can be tested by archiving a schema, verifying it is hidden from default list but visible via filter, confirming existing instances are unaffected, and restoring to draft.

**Acceptance Scenarios**:

1. **Given** a published schema, **When** an admin archives it, **Then** the schema status becomes `archived`, it is hidden from the default list, and existing instances continue to function.
2. **Given** an archived schema, **When** an admin restores it, **Then** the schema status returns to `draft` and becomes editable again.
3. **Given** an archived schema, **When** a researcher attempts to create a new instance, **Then** the system returns `422`.

---

### User Story 6 — Supervisor Views Instance Status (Priority: P3)

A supervisor views the list of survey instances to monitor group assignments, timing, and completion counts. They do not access individual response content.

**Why this priority**: Read-only oversight is valuable for supervision workflows but is not on the critical deployment path.

**Independent Test**: Can be tested by logging in as a supervisor, viewing instance list with counts, and verifying no access to individual answers.

**Acceptance Scenarios**:

1. **Given** a supervisor, **When** they view the instance list, **Then** they see schema title, status, groups, dates, and completion counts.
2. **Given** a supervisor, **When** they attempt to access individual response answers, **Then** the system denies access.

---

### Edge Cases

- **User in multiple groups with overlapping active surveys**: All pending surveys must be completed before chat. Shown one at a time in order of `priority ASC` (ties broken by `startDate ASC`).
- **Instance expires while user is mid-response**: Submission is allowed; expiry check applies only to gate display, not in-flight responses.
- **User partially completes and exits**: Response persists as `isComplete = false`; gate re-shown on next access with partial answers pre-filled.
- **User has no group assignments**: No gate shown; chat loads normally.
- **All required questions answered but user exits before submit**: Response not yet marked complete; gate re-shown.
- **Concurrent partial saves from multiple tabs/devices**: Last-write-wins; no conflict detection or optimistic locking.
- **Draft schema with existing instances is deleted**: System returns `409 Conflict`.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow researchers to create, edit, and publish survey schemas containing ordered, typed questions.
- **FR-002**: System MUST enforce schema immutability after publication — any write to a published or archived schema MUST return `403 Forbidden`.
- **FR-003**: System MUST support four question types: `free_text`, `single_choice`, `multi_choice`, and `boolean`.
- **FR-004**: System MUST require at least one question before a schema can be published.
- **FR-005**: System MUST support cloning any schema (draft, published, or archived) into a new independent draft.
- **FR-006**: System MUST allow creation of time-boxed, group-scoped survey instances from published schemas only.
- **FR-007**: System MUST freeze a deep-copy snapshot of the schema at instance creation time; all rendering and validation MUST use the snapshot exclusively.
- **FR-008**: System MUST enforce that `expirationDate > startDate` for all instances via both API validation and database constraint.
- **FR-009**: System MUST automatically transition instance status (`draft → active`, `active → expired`) based on configured dates via a scheduled background job.
- **FR-010**: System MUST block chat access for users who belong to groups with active, unresponded survey instances, displaying a survey gate instead.
- **FR-011**: System MUST store all survey responses under the user's pseudonymous ID — never the raw user primary key.
- **FR-012**: System MUST persist partial survey progress and pre-fill answers when the user returns.
- **FR-013**: System MUST enforce a unique constraint of one response per user per instance.
- **FR-014**: System MUST support the `riskFlag` metadata field on questions, stored but not acted upon in MVP.
- **FR-015**: System MUST cascade deletion of survey responses when a user's pseudonymous record is erased, within the 30-day GDPR SLA.
- **FR-016**: System MUST restrict supervisor role to read-only access on instance metadata and completion counts — no individual response content.
- **FR-017**: System MUST allow admins to archive published schemas and restore archived schemas to draft.
- **FR-018**: System MUST prevent deletion of draft schemas that have any associated instances (`409 Conflict`).
- **FR-019**: System MUST require at least one group assignment when creating an instance.
- **FR-020**: System MUST allow researchers and admins to manually close an active instance.
- **FR-021**: System MUST allow researchers and admins to view individual pseudonymous survey responses for all instances. Supervisor access to individual response content remains prohibited (see FR-016).
- **FR-022**: System MUST support invalidating survey results from the Workbench at three scopes: (1) all results for a survey instance, (2) all results for a specific target group within an instance, and (3) an individual response.
- **FR-023**: Survey gate UI MUST display progress as current question number / total question count, and MUST include a final Review step before submission that allows users to revisit and edit any answered question prior to final Submit.
- **FR-024**: When a response is invalidated and the instance is still `active`, the invalidation MUST re-open the gate for the affected user(s) until they re-submit a complete response. Invalidated results MUST be excluded from completion counts and downstream use (e.g., exports), and any memory derived from the invalidated results MUST be removed.
- **FR-025**: Survey instances MUST support an “Add to memory” option (default off). When enabled, completion of a survey MUST asynchronously upsert a single canonical survey-memory payload for that user+instance keyed by `(pseudonymousId, instanceId)`; no duplicate or conflicting “facts” are permitted for the same user+instance.
- **FR-026**: If a response (or scope of responses) is invalidated, any survey-memory payload(s) derived from the invalidated response(s) MUST be removed asynchronously; if the user later completes the survey again, the memory payload MUST be replaced/updated (no fact ambiguity or duplication).
- **FR-027**: When “Add to memory” is enabled, the survey-memory payload MUST be a human-readable summary text in a canonical/deterministic format derived from `schemaSnapshot` + the user’s answers; it MUST be replace-only per `(pseudonymousId, instanceId)` (no duplicates).

### Key Entities

- **SurveySchema**: A reusable survey definition containing an ordered list of typed questions. Follows a `draft → published → archived` lifecycle with strict immutability after publication.
- **SurveyQuestion** (embedded in schema): An individual question with a type (`free_text`, `single_choice`, `multi_choice`, `boolean`), display text, ordering, required flag, optional validation rules, and a `riskFlag` field.
- **SurveyInstance**: A time-boxed, group-scoped deployment of a published schema. Contains a frozen snapshot of the schema at creation time. Follows `draft → active → expired/closed` lifecycle.
- **SurveyResponse**: A user's answers to a specific survey instance, linked by pseudonymous ID. Supports partial saves with completion tracking.
- **SurveyAnswer** (embedded in response): An individual answer to a question, typed to match the question type.

---

## Goals & Non-Goals

### In Scope (MVP)

- Researchers author surveys (schemas) in the Workbench with ordered, typed questions.
- Published schemas are immutable; changes require cloning.
- Survey instances are time-boxed, group-scoped, and status-managed.
- Users encounter a blocking gate before chat if an active unresponded survey exists.
- All responses stored under pseudonymous ID, never raw user PK.
- GDPR-compliant storage and erasure cascade.

### Out of Scope (MVP)

- Conditional / branching question logic (post-MVP).
- Automated scoring or subscale computation (post-MVP).
- Analytics dashboards on response data (Phase 3).
- Response export to policy pipeline (Phase 3).
- Multi-language question text beyond what is authored manually.
- Versioning of schemas (clone is the mechanism).

---

## Actors & Permissions

| Actor | Capabilities |
|---|---|
| **Researcher** | Create/edit/publish/clone/delete draft schemas; create/close instances; view individual pseudonymous responses for all instances |
| **Admin** | All Researcher actions + archive/restore schemas |
| **Supervisor** | Read-only: view instances and group assignments |
| **User (Officer)** | Complete assigned surveys via the chat gate |

No new roles are introduced. All capabilities are added to the existing RBAC model.

---

## Data Model

### `SurveySchema`

```
SurveySchema {
  id:            UUID PK
  title:         string       NOT NULL, max 200
  description:   string       nullable, max 1000
  status:        enum         { draft | published | archived }  DEFAULT draft
  questions:     JSONB        ordered array of SurveyQuestion
  clonedFromId:  UUID         nullable FK → SurveySchema
  createdBy:     UUID         FK → User
  createdAt:     timestamptz
  publishedAt:   timestamptz  nullable
  archivedAt:    timestamptz  nullable
  updatedAt:     timestamptz
}
```

### `SurveyQuestion` (embedded JSONB in `SurveySchema.questions`)

```
SurveyQuestion {
  id:          UUID       stable identifier within schema
  order:       integer    1-based, contiguous, unique within schema
  type:        enum       { free_text | single_choice | multi_choice | boolean }
  text:        string     NOT NULL, max 500
  required:    boolean    DEFAULT true
  options:     string[]   REQUIRED for single_choice / multi_choice; null otherwise
  validation: {            only for free_text; null otherwise
    regex?:     string | null
    minLength?: integer | null
    maxLength?: integer | null
  }
  riskFlag:    boolean    DEFAULT false  — reserved; not acted on in MVP
}
```

**Constraints:**

- `options` non-empty array required for `single_choice` and `multi_choice`.
- `options` must be null/absent for `free_text` and `boolean`.
- `validation` is null/absent for non-`free_text` types.
- `order` values must be unique and contiguous (1, 2, 3 … N) within a schema.
- Minimum 1 question required before a schema can be published.

### `SurveyInstance`

```
SurveyInstance {
  id:              UUID PK
  schemaId:        UUID         FK → SurveySchema
  schemaSnapshot:  JSONB        full deep-copy of SurveySchema at instance creation time
  title:           string       denormalised from snapshot for display
  status:          enum         { draft | active | expired | closed }  DEFAULT draft
  priority:        integer      NOT NULL DEFAULT 0  — controls gate display order (ascending; lower = shown first)
  addToMemory:     boolean      DEFAULT false — when true, completion upserts canonical survey-memory payload for user+instance
  groupIds:        UUID[]       min 1 required; FK → existing Group entity
  startDate:       timestamptz  NOT NULL
  expirationDate:  timestamptz  NOT NULL  — must be strictly > startDate (DB CHECK)
  createdBy:       UUID         FK → User
  createdAt:       timestamptz
  closedAt:        timestamptz  nullable  — set on manual close
  updatedAt:       timestamptz
}
```

### `SurveyResponse`

```
SurveyResponse {
  id:             UUID PK
  instanceId:     UUID         FK → SurveyInstance
  pseudonymousId: UUID         FK → pseudonymous user ID — NEVER raw user PK
  groupId:        UUID         FK → Group — the specific group context used to satisfy the gate at time of submission (required)
  answers:        JSONB        ordered array of SurveyAnswer
  startedAt:      timestamptz
  completedAt:    timestamptz  nullable
  isComplete:     boolean      DEFAULT false
  invalidatedAt:  timestamptz  nullable — set when results are invalidated via Workbench
  invalidatedBy:  UUID         nullable — actor user id (Researcher/Admin) who invalidated; null allowed for system/backfill
  invalidationReason: string   nullable — short human-entered reason (optional in MVP)
  UNIQUE (instanceId, pseudonymousId)
}
```

### `SurveyAnswer` (embedded JSONB in `SurveyResponse.answers`)

```
SurveyAnswer {
  questionId: UUID     references SurveyQuestion.id in schemaSnapshot
  value:      string | string[] | boolean | null
}
```

**Answer type rules:**

| Question type | Expected `value` type |
|---|---|
| `free_text` | `string` |
| `single_choice` | `string` (one of `options`) |
| `multi_choice` | `string[]` (subset of `options`) |
| `boolean` | `boolean` |

---

## Schema Lifecycle

```
         create            publish           archive
 ───────▶ draft ──────────▶ published ──────▶ archived
            ▲                                    │
            └────────────────────────────────────┘
                        restore → draft
```

| Transition | Rules |
|---|---|
| `create` | Status = `draft`. All fields mutable. |
| `draft → published` | Requires ≥ 1 question. Irreversible. Sets `publishedAt`. |
| `published → archived` | Hides from default listings. Existing instances unaffected. New instances blocked. Sets `archivedAt`. |
| `archived → draft` | Restores to editable draft. Clears `archivedAt`. |
| `delete` | Only from `draft`. Blocked (`409`) if any `SurveyInstance` references this schema. |
| `clone` | Available on any status. Creates new `draft` schema. Copies all questions. Sets `clonedFromId`. Fully independent. |
| **Immutability** | Any write to a `published` or `archived` schema returns `403 Forbidden`. No exceptions. |

---

## Instance Lifecycle

```
  create           auto-activate        auto-expire
 ────────▶ draft ─────────────▶ active ─────────────▶ expired
                                   │
                                   │ manual close
                                   ▼
                                closed
```

### Timing Rules (Strict)

- `startDate` **required**. API rejects creation without it (`422`).
- `expirationDate` **required**. API rejects creation without it (`422`).
- `expirationDate` must be strictly `> startDate`. Enforced by DB `CHECK` constraint and API validation.
- No instance may be created without both dates. No exception.
- `draft → active`: automatic when `now() >= startDate`.
- `active → expired`: automatic when `now() >= expirationDate`.
- `active → closed`: manual action by Researcher/Admin. Sets `closedAt`.
- Instances can only be created from a `published` schema. `draft` or `archived` schema returns `422`.

### Snapshot Rule (Strict)

- `schemaSnapshot` is written once at instance creation and **never updated**.
- All instance operations — including gate rendering and response validation — read `schemaSnapshot` exclusively.
- The live `SurveySchema` record is never read from the instance context after creation.
- No data drift permitted.

---

## User-Facing Gate Behaviour

When a user initiates a chat session:

1. Resolve all groups the user belongs to.
2. Query `SurveyInstance` where `status = active` AND `groupIds` overlaps user's groups.
3. For each matched instance: check for a `SurveyResponse` with `pseudonymousId = user.pseudonymousId AND isComplete = true AND invalidatedAt IS NULL`.
4. **If any unresponded active instances exist** → block chat; render survey gate.
5. Questions rendered from `schemaSnapshot` — never from live schema.
6. On successful submission: set `isComplete = true`, record `completedAt`, advance to next pending survey or dismiss gate.
7. If the instance has “Add to memory” enabled: asynchronously upsert a canonical, structured survey-memory payload keyed by `(pseudonymousId, instanceId)` using the existing memory update mechanism (same asynchronous pattern as chat session memory updates).
8. **If no pending surveys** → chat loads normally.

If a previously completed response is later invalidated for that user and the instance is still `active`, the instance is treated as pending again and the gate must be shown until a new complete response is submitted.

### Gate Edge Cases

| Scenario | Behaviour |
|---|---|
| User in multiple groups; multiple overlapping active surveys | All must be completed before chat. Shown one at a time in order of `priority ASC` (lower = first); ties broken by `startDate ASC` |
| Instance expires while user is mid-response | Allow submission; expiry check applies only to gate display, not in-flight responses |
| User partially completes and exits | Response persists as `isComplete = false`; gate shown again on next access with partial answers pre-filled |
| User has no group assignments | No gate shown; chat loads normally |
| All required questions in a survey are answered but user exits before submit | Response not yet marked complete; gate re-shown |
| Response is invalidated after completion while instance is still `active` | Gate must re-open for affected user(s) until re-submitted; invalidated results excluded from counts/exports and any derived memory removed |
| Response is invalidated after instance is `expired` or `closed` | No gate is shown (instance is not active); invalidation affects reporting/exports and derived memory removal only |

---

## API Specification

### Schema Endpoints (Workbench)

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/workbench/survey-schemas` | Researcher, Admin | List schemas; default excludes archived |
| `GET` | `/api/workbench/survey-schemas?status=archived` | Researcher, Admin | List archived schemas |
| `POST` | `/api/workbench/survey-schemas` | Researcher, Admin | Create draft schema |
| `GET` | `/api/workbench/survey-schemas/:id` | Researcher, Admin | Get schema detail |
| `PATCH` | `/api/workbench/survey-schemas/:id` | Researcher, Admin | Update draft (blocked if published/archived) |
| `POST` | `/api/workbench/survey-schemas/:id/publish` | Researcher, Admin | Publish draft (requires ≥ 1 question) |
| `POST` | `/api/workbench/survey-schemas/:id/archive` | Admin | Archive published schema |
| `POST` | `/api/workbench/survey-schemas/:id/restore` | Admin | Restore archived → draft |
| `POST` | `/api/workbench/survey-schemas/:id/clone` | Researcher, Admin | Clone to new draft |
| `DELETE` | `/api/workbench/survey-schemas/:id` | Researcher, Admin | Delete draft (blocked if instances exist) |

### Instance Endpoints (Workbench)

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/workbench/survey-instances` | Researcher, Admin, Supervisor | List instances |
| `POST` | `/api/workbench/survey-instances` | Researcher, Admin | Create instance from published schema |
| `GET` | `/api/workbench/survey-instances/:id` | Researcher, Admin, Supervisor | Instance detail with snapshot |
| `POST` | `/api/workbench/survey-instances/:id/close` | Researcher, Admin | Manually close active instance |
| `GET` | `/api/workbench/survey-instances/:id/responses` | Researcher, Admin | List responses for an instance (includes invalidation fields) |
| `POST` | `/api/workbench/survey-instances/:id/invalidate` | Researcher, Admin | Invalidate results for an instance (all responses) |
| `POST` | `/api/workbench/survey-instances/:id/invalidate-group` | Researcher, Admin | Invalidate results for a specific group within an instance |
| `POST` | `/api/workbench/survey-responses/:id/invalidate` | Researcher, Admin | Invalidate a single response |

### Gate Endpoints (User-facing)

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/chat/gate-check` | User | Returns pending active survey instances for user's groups |
| `GET` | `/api/chat/survey-responses/:instanceId` | User | Get own response (resume partial) |
| `POST` | `/api/chat/survey-responses` | User | Create or update response |
| `PATCH` | `/api/chat/survey-responses/:id` | User | Save partial progress |

### Error Codes

| Scenario | Status |
|---|---|
| PATCH/edit on published or archived schema | `403 Forbidden` |
| Publish with zero questions | `422 Unprocessable Entity` |
| Delete schema with existing instances | `409 Conflict` |
| Create instance from non-published schema | `422 Unprocessable Entity` |
| Create instance with missing `startDate` or `expirationDate` | `422 Unprocessable Entity` |
| Create instance where `expirationDate ≤ startDate` | `422 Unprocessable Entity` |
| Any write to immutable schema field | `403 Forbidden` |

---

## Database Migration

```sql
-- SurveySchema
CREATE TABLE survey_schemas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(200)  NOT NULL,
  description     TEXT,
  status          VARCHAR(20)   NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
  questions       JSONB         NOT NULL DEFAULT '[]',
  cloned_from_id  UUID          REFERENCES survey_schemas(id),
  created_by      UUID          NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- SurveyInstance
CREATE TABLE survey_instances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id        UUID          NOT NULL REFERENCES survey_schemas(id),
  schema_snapshot  JSONB         NOT NULL,
  title            VARCHAR(200)  NOT NULL,
  status           VARCHAR(20)   NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','active','expired','closed')),
  priority         INTEGER       NOT NULL DEFAULT 0,
  group_ids        UUID[]        NOT NULL,
  start_date       TIMESTAMPTZ   NOT NULL,
  expiration_date  TIMESTAMPTZ   NOT NULL,
  created_by       UUID          NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT expiry_after_start CHECK (expiration_date > start_date)
);

-- SurveyResponse
CREATE TABLE survey_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id      UUID          NOT NULL REFERENCES survey_instances(id),
  pseudonymous_id  UUID          NOT NULL,
  answers          JSONB         NOT NULL DEFAULT '[]',
  started_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  is_complete      BOOLEAN       NOT NULL DEFAULT false,
  UNIQUE (instance_id, pseudonymous_id)
);

-- Indexes
CREATE INDEX idx_survey_instances_status     ON survey_instances(status);
CREATE INDEX idx_survey_instances_group_ids  ON survey_instances USING GIN(group_ids);
CREATE INDEX idx_survey_responses_instance   ON survey_responses(instance_id);
CREATE INDEX idx_survey_responses_pseudo     ON survey_responses(pseudonymous_id);
```

**Migration requirements:**

- Migration script must be reviewed and approved before merge.
- Documented rollback path required.
- Zero changes to existing tables.

---

## Workbench UI

### Schema List (`/workbench/surveys/schemas`)

- Table: Title, Status badge, Question count, Created date, Published date. Actions: Edit (draft only), Clone, Archive/Restore, Delete.
- Default view excludes archived. Toggle to show archived.

### Schema Editor (`/workbench/surveys/schemas/:id/edit`)

- Title and description fields.
- Question list: drag-to-reorder (draft only); add / remove questions.
- Per question: type selector → question text → required toggle.
- `single_choice` / `multi_choice`: inline option list editor.
- `free_text`: optional validation fields (regex, minLength, maxLength).
- Publish button: disabled until ≥ 1 question exists. Shows confirmation modal noting immutability before confirming.
- Published / archived schemas: fully read-only render with Clone button.

### Instance Manager (`/workbench/surveys/instances`)

- Table: Schema title, Status badge, Groups assigned, Start date, Expiry date, Completed responses count.
- Create button opens inline form: schema picker (published only), group multi-select, start/expiry datetime pickers, and an “Add to memory” toggle (default off).
- Expiry datepicker disables dates ≤ start date.
- Instance detail: read-only snapshot, group list, timing info, Close button (active instances only).
- Instance detail includes Responses view (Researcher/Admin only) with invalidation actions:
  - Invalidate all results for the instance
  - Invalidate results for a selected group within the instance
  - Invalidate an individual response
  Invalidated responses are visibly marked and excluded from completion counts.
  If “Add to memory” is enabled on the instance, invalidation actions must also trigger removal of the corresponding survey-memory payload(s) derived from the invalidated response(s).

### Survey Gate (User-facing)

- Full-screen blocking overlay or dedicated page; shown before chat renders.
- Progress indicator: shows current question number / total (e.g., "Question X of N").
- Navigation: Next / Back. On the last question, provide a Review step before final Submit.
- Required questions prevent Next if unanswered.
- Partial progress auto-saved on each Next.
- On complete: gate dismissed; next pending survey shown or chat loads.
- Review step: user can view the list of questions and their current answers, jump back to edit any question, then return to Review and Submit.

---

## Scheduled Status Transitions

A background job handles automatic `draft → active` and `active → expired` transitions.

```
Every 60 seconds (configurable):
  UPDATE survey_instances
    SET status = 'active', updated_at = now()
    WHERE status = 'draft' AND start_date <= now();

  UPDATE survey_instances
    SET status = 'expired', updated_at = now()
    WHERE status = 'active' AND expiration_date <= now();
```

- Must be **idempotent**.
- Each transition event written to audit log with `actor = 'system'`.
- Run frequency is configurable via env var (`SURVEY_JOB_INTERVAL_SECONDS`, default `60`).

---

## Business Logic Enforcement Summary

| Rule | Where enforced |
|---|---|
| Schema immutable after publish | Service layer + DB-level guard in migration |
| Instance reads snapshot only; never live schema | Service layer — `schema_id` JOIN prohibited in instance context |
| `expirationDate > startDate` | DB `CHECK` constraint + API `422` |
| Instance only from published schema | Service layer check pre-insert |
| Delete blocked if instances exist | Service layer `409` check pre-delete |
| Pseudonymous ID only in responses | Service layer — raw user PK never passed to response writer |
| No silent data mutations | All state transitions are explicit API calls; no background field mutations except timed status job (documented above) |

---

## Privacy & GDPR

- `survey_responses.pseudonymous_id` references the existing pseudonymous ID layer. The raw user PK is never stored in this table.
- Right-to-erasure cascade: deletion of a user's pseudonymous record must propagate to `survey_responses` within the 30-day SLA defined in the MHG data model. Tested before go-live.
- GDPR consent for survey participation reuses the existing consent screen. No new consent UI needed in MVP.
- Supervisor role: can view instance metadata and group assignments. Cannot view individual response content.
- Aggregate counts shown in instance list are `COUNT(is_complete = true)` only — no individual answer exposure.

---

## Security

- All new API routes inherit existing auth middleware. No unauthenticated endpoints.
- RBAC enforced at the service layer for every endpoint (see Actors & Permissions).
- No new roles introduced. Any future role additions require a security review and documented access matrix update.
- Schema and instance data included in next scheduled penetration test (per cross-cutting security schedule).

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Researchers can author and publish a survey schema containing up to 70 questions within 15 minutes.
- **SC-002**: Survey instances automatically transition between statuses within 60 seconds of their configured dates (configurable).
- **SC-003**: 100% of survey responses are stored under pseudonymous IDs — zero raw user PKs in the `survey_responses` table.
- **SC-004**: Officers can complete a 25-question intake survey in under 10 minutes via the gate UI.
- **SC-005**: Officers can complete a 67-question boolean survey in under 15 minutes via the gate UI.
- **SC-006**: Partial survey progress is preserved with zero data loss on session interruption; users resume exactly where they left off.
- **SC-007**: No published schema can be modified by any actor through any endpoint — 100% immutability enforcement.
- **SC-008**: Schema snapshots on instances remain identical to the original schema at creation time, regardless of subsequent schema changes — zero data drift.
- **SC-009**: GDPR erasure cascade from pseudonymous ID to survey responses completes within the 30-day SLA.
- **SC-010**: All acceptance criteria in this specification pass in automated and manual testing before production promotion.

---

## Acceptance Criteria

### AC-1 · Schema Lifecycle

- [ ] Researcher can create a draft schema and freely edit title, description, and questions.
- [ ] Publish is blocked if schema has zero questions — error returned.
- [ ] After publish, any PATCH to schema or questions returns `403`.
- [ ] Archived schema disappears from default list view; visible via `?status=archived`.
- [ ] Archived schema can be restored to draft and edited.
- [ ] Draft schema with no instances can be deleted.
- [ ] Draft schema with ≥ 1 instance returns `409` on delete attempt.
- [ ] Clone produces a new independent draft with all questions copied and `clonedFromId` set.

### AC-2 · Questions

- [ ] Questions reorder by drag-and-drop in draft; order persists correctly.
- [ ] `single_choice` and `multi_choice` require ≥ 1 option to save.
- [ ] `free_text` accepts regex, minLength, maxLength; other types do not expose these fields.
- [ ] `boolean` questions have no options and no validation fields.
- [ ] After publish, question order and content cannot be changed.

### AC-3 · Instances

- [ ] Instance creation from a `draft` or `archived` schema returns `422`.
- [ ] Instance creation without `startDate` or `expirationDate` returns `422`.
- [ ] Instance creation with `expirationDate ≤ startDate` returns `422`.
- [ ] `schemaSnapshot` matches schema content at time of creation exactly.
- [ ] Modifying the source schema after instance creation does not change `schemaSnapshot`.
- [ ] Instance auto-transitions `draft → active` when `now >= startDate`.
- [ ] Instance auto-transitions `active → expired` when `now >= expirationDate`.
- [ ] Researcher can manually close an active instance; `closedAt` is recorded.
- [ ] Instance requires ≥ 1 group assigned.
- [ ] Each response records the specific `groupId` context used at submission time (one of the instance’s `groupIds` and one of the user’s active group memberships).

### AC-4 · Gate

- [ ] User in an assigned group with an active unresponded instance cannot reach chat.
- [ ] User with a complete response for all active instances loads chat directly.
- [ ] Gate renders questions from `schemaSnapshot`, not live schema.
- [ ] Required questions block form progression if unanswered.
- [ ] Partial response is saved; gate resumes with partial answers pre-filled on return.
- [ ] After instance expiry, gate is no longer shown for that instance.
- [ ] All pending surveys must be completed before chat access is granted.
- [ ] Multiple pending surveys are shown sequentially in `priority ASC` order (ties broken by `startDate ASC`).
- [ ] If a previously completed response is invalidated while the instance is still `active`, the gate re-opens for the affected user(s) until they submit a new complete response.
- [ ] Gate displays progress as current question number / total, and includes a Review step before final Submit allowing the user to revisit/edit any question before submission.
- [ ] If a response is invalidated for “group scope” while an instance is still `active`, only users whose recorded response `groupId` matches that group become gated again (users outside that group are unaffected).

### AC-7 · Invalidation

- [ ] Researcher/Admin can invalidate all results for a survey instance; all affected responses are marked invalidated and excluded from completion counts.
- [ ] Researcher/Admin can invalidate results for a specific group within an instance; only responses whose recorded `groupId` matches are invalidated.
- [ ] Researcher/Admin can invalidate an individual response; only that response is invalidated.
- [ ] Invalidating a response does not delete the response record; it marks it invalidated and preserves auditability.

### AC-8 · Add to Memory

- [ ] When “Add to memory” is enabled for an instance and a user completes the survey, the system asynchronously upserts a single canonical survey-memory payload keyed by `(pseudonymousId, instanceId)` (replace-only; no duplicates).
- [ ] If the same user completes the same instance again after invalidation/re-open, the survey-memory payload is updated (replaced) rather than duplicated.
- [ ] If a response is invalidated (instance-wide, group scope, or individual), the system asynchronously removes the corresponding survey-memory payload(s) derived from the invalidated response(s).
- [ ] The survey-memory payload content is a canonical, deterministic human-readable summary text derived from `schemaSnapshot` + answers (no fact ambiguity or duplication for the same `(pseudonymousId, instanceId)`).

### AC-5 · Privacy

- [ ] `survey_responses` stores `pseudonymous_id` only — not raw user PK.
- [ ] Supervisor role cannot access individual response answer content.
- [ ] Erasure cascade for pseudonymous ID propagates to `survey_responses`.
- [ ] Researcher can view individual pseudonymous responses for any instance.
- [ ] Admin can view individual pseudonymous responses for any instance.

### AC-6 · Immutability

- [ ] No field on a `published` or `archived` schema can be mutated by any actor.
- [ ] `schemaSnapshot` on an instance is never updated after creation.
- [ ] No timed or background job silently mutates schema or snapshot fields.

---

## Out of Scope — Future Phases

| Item | Target |
|---|---|
| Conditional / skip logic (Q6, Q9, Q22 in intake form) | Post-MVP |
| Subscale score computation (Shtepa HAB instrument) | Post-MVP |
| Risk flag automation from `riskFlag: true` questions | Post-MVP (Phase 2 integration) |
| Response analytics dashboards | Phase 3 |
| Response export to policy pipeline | Phase 3 |
| Multi-language question text | Post-MVP |

---

## Assumptions

- The existing `Group` entity and pseudonymous ID layer are stable and available for integration.
- The existing RBAC model supports adding new capabilities to Researcher, Admin, and Supervisor roles without schema changes.
- The scheduled job infrastructure (Cloud Scheduler or equivalent) is available in the deployment environment.
- The existing consent screen covers survey participation — no new consent UX is needed.
- The existing auth middleware protects all new routes without additional configuration beyond route registration.
- Performance targets assume standard web application expectations unless otherwise specified.

---

## Open Questions

| # | Question | Owner |
|---|---|---|
| ~~1~~ | ~~Should users see all pending surveys before chat per session, or one per session maximum?~~ **Resolved:** All pending surveys must be completed before chat. Display order controlled by `priority` field on `SurveyInstance` (ascending). | Product |
| ~~2~~ | ~~Minimum group size before an instance can be activated? Suggest ≥ 25 (consistent with existing k-anonymity policy).~~ **Resolved:** No minimum group size enforced. Any group can receive a survey instance. | Legal |
| ~~3~~ | ~~Should the `riskFlag` field on Q11 (self-harm ideation) trigger any workbench notification in MVP, or store-only?~~ **Resolved:** Store-only in MVP. No runtime behaviour or notifications. Phase 2 integration. | Clinical |
| 4 | Scheduled job implementation: Cloud Scheduler cron vs. event-driven trigger on `start_date` / `expiration_date`? | Engineering |
| ~~5~~ | ~~Should a Researcher be able to view raw response answers (not aggregated) for their own instances?~~ **Resolved:** Researchers and Admins can view individual pseudonymous responses for all instances. Supervisor access remains prohibited. | Product + Legal |
