# Data Model: Workbench Survey Module

**Branch**: `018-workbench-survey` | **Date**: 2026-03-03

## Entity Relationship Diagram

```
┌──────────────────┐          ┌────────────────────────┐          ┌──────────────────────────┐
│  SurveySchema    │          │  SurveyInstance         │          │  SurveyResponse          │
├──────────────────┤          ├────────────────────────┤          ├──────────────────────────┤
│ id          UUID │◄───FK────│ schema_id        UUID   │          │ id                 UUID  │
│ title       str  │          │ schema_snapshot  JSONB  │          │ instance_id        UUID  │──FK──► SurveyInstance.id
│ description str  │          │ title            str    │          │ pseudonymous_id    UUID  │
│ status      enum │          │ status           enum   │          │ group_id           UUID  │──FK──► Group.id (existing)
│ questions   JSONB│          │ priority         int    │          │ answers            JSONB  │
│ cloned_from UUID │───FK──►  │ add_to_memory    bool   │          │ started_at         tstz  │
│ created_by  UUID │          │ group_ids        UUID[] │          │ completed_at       tstz  │
│ created_at  tstz │          │ start_date       tstz   │          │ is_complete        bool  │
│ published_at tstz│          │ expiration_date  tstz   │          │ invalidated_at     tstz  │
│ archived_at tstz │          │ created_by       UUID   │          │ invalidated_by     UUID  │
│ updated_at  tstz │          │ created_at       tstz   │          │ invalidation_reason text │
└──────────────────┘          │ closed_at        tstz   │          └──────────────────────────┘
                              │ updated_at       tstz   │
                              └────────────────────────┘

UNIQUE(survey_responses.instance_id, survey_responses.pseudonymous_id)
```

## Entities

### SurveySchema

Represents a reusable survey definition. Immutable after publication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `title` | `VARCHAR(200)` | NOT NULL | Display title |
| `description` | `TEXT` | nullable | Optional description, max 1000 chars (app-level) |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT `'draft'`, CHECK `IN ('draft','published','archived')` | Lifecycle state |
| `questions` | `JSONB` | NOT NULL, DEFAULT `'[]'` | Ordered array of `SurveyQuestion` objects |
| `cloned_from_id` | `UUID` | nullable, FK → `survey_schemas(id)` | Source schema if cloned |
| `created_by` | `UUID` | NOT NULL, FK → `users(id)` | Creator |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `published_at` | `TIMESTAMPTZ` | nullable | Set on `draft → published` |
| `archived_at` | `TIMESTAMPTZ` | nullable | Set on `published → archived`; cleared on restore |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | Last modification |

**State transitions**: `draft` → `published` → `archived` → `draft` (restore)

**Immutability rule**: Any write to a row where `status != 'draft'` returns `403`.

### SurveyQuestion (embedded JSONB)

Each element in `SurveySchema.questions` array:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | required, unique within schema | Stable question identifier |
| `order` | `integer` | required, 1-based, contiguous, unique within schema | Display order |
| `type` | `string` | required, one of: `free_text`, `single_choice`, `multi_choice`, `boolean` | Question type |
| `text` | `string` | required, max 500 chars | Question text |
| `required` | `boolean` | default `true` | Whether answer is mandatory |
| `options` | `string[]` | required for `single_choice`/`multi_choice`; null otherwise | Choice options |
| `validation` | `object \| null` | only for `free_text` | `{ regex?, minLength?, maxLength? }` |
| `riskFlag` | `boolean` | default `false` | Reserved for post-MVP risk escalation |

**Type-specific validation rules**:

| Type | `options` | `validation` |
|------|-----------|-------------|
| `free_text` | must be null | optional `{ regex, minLength, maxLength }` |
| `single_choice` | required, ≥ 1 item | must be null |
| `multi_choice` | required, ≥ 1 item | must be null |
| `boolean` | must be null | must be null |

### SurveyInstance

A time-boxed deployment of a published schema to one or more groups.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `schema_id` | `UUID` | NOT NULL, FK → `survey_schemas(id)` | Source schema reference |
| `schema_snapshot` | `JSONB` | NOT NULL | Frozen deep-copy of schema at creation time |
| `title` | `VARCHAR(200)` | NOT NULL | Denormalised from snapshot for display |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT `'draft'`, CHECK `IN ('draft','active','expired','closed')` | Lifecycle state |
| `priority` | `INTEGER` | NOT NULL, DEFAULT `0` | Gate display order (ascending, lower = first) |
| `add_to_memory` | `BOOLEAN` | NOT NULL, DEFAULT `false` | When true, completion upserts a canonical survey-memory payload |
| `group_ids` | `UUID[]` | NOT NULL, ≥ 1 element | Target groups |
| `start_date` | `TIMESTAMPTZ` | NOT NULL | Activation time |
| `expiration_date` | `TIMESTAMPTZ` | NOT NULL | Expiry time, must be `> start_date` |
| `created_by` | `UUID` | NOT NULL, FK → `users(id)` | Creator |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `closed_at` | `TIMESTAMPTZ` | nullable | Set on manual close |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | Last modification |

**DB constraints**: `CHECK (expiration_date > start_date)`

**State transitions**: `draft` → `active` (auto) → `expired` (auto) or `closed` (manual)

**Snapshot rule**: `schema_snapshot` is written once at creation and never updated.

### SurveyResponse

A user's answers to a specific survey instance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK, DEFAULT `gen_random_uuid()` | Unique identifier |
| `instance_id` | `UUID` | NOT NULL, FK → `survey_instances(id)` | Target instance |
| `pseudonymous_id` | `UUID` | NOT NULL | Pseudonymous user identity (never raw user PK) |
| `group_id` | `UUID` | NOT NULL, FK → `groups(id)` | Group context used for submission (required for group-scope invalidation) |
| `answers` | `JSONB` | NOT NULL, DEFAULT `'[]'` | Ordered array of `SurveyAnswer` objects |
| `started_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | First interaction time |
| `completed_at` | `TIMESTAMPTZ` | nullable | Submission time |
| `is_complete` | `BOOLEAN` | NOT NULL, DEFAULT `false` | Whether fully submitted |
| `invalidated_at` | `TIMESTAMPTZ` | nullable | When set, response is excluded from counts/exports/gate completion |
| `invalidated_by` | `UUID` | nullable | Actor who invalidated (Researcher/Admin) |
| `invalidation_reason` | `TEXT` | nullable | Optional human-entered reason |

**Unique constraint**: `UNIQUE (instance_id, pseudonymous_id)` — one response per user per instance.

**Gate completion rule**: A response satisfies the gate only if `is_complete = true` AND `invalidated_at IS NULL`.

### SurveyAnswer (embedded JSONB)

Each element in `SurveyResponse.answers` array:

| Field | Type | Description |
|-------|------|-------------|
| `questionId` | `UUID` | References `SurveyQuestion.id` in `schemaSnapshot` |
| `value` | `string \| string[] \| boolean \| null` | Typed answer value |

**Answer type mapping**:

| Question type | Answer `value` type |
|---------------|---------------------|
| `free_text` | `string` |
| `single_choice` | `string` (must be one of `options`) |
| `multi_choice` | `string[]` (must be subset of `options`) |
| `boolean` | `boolean` |

## Indexes

| Index | Table | Column(s) | Type | Purpose |
|-------|-------|-----------|------|---------|
| `idx_survey_instances_status` | `survey_instances` | `status` | B-tree | Status filter for scheduled job |
| `idx_survey_instances_group_ids` | `survey_instances` | `group_ids` | GIN | Array overlap queries for gate-check |
| `idx_survey_responses_instance` | `survey_responses` | `instance_id` | B-tree | Response lookup by instance |
| `idx_survey_responses_pseudo` | `survey_responses` | `pseudonymous_id` | B-tree | GDPR erasure cascade lookup |
| `idx_survey_responses_instance_group` | `survey_responses` | `(instance_id, group_id)` | B-tree | Group-scope invalidation queries |
| `idx_survey_responses_valid_gate` | `survey_responses` | `(instance_id, pseudonymous_id)` | B-tree (or partial) | Efficient gate completion checks; consider partial index `WHERE invalidated_at IS NULL` |

## Migration

File: `chat-backend/src/db/migrations/024_create_survey_tables.sql`

See spec.md § Database Migration for full SQL.

**Rollback**: `DROP TABLE survey_responses; DROP TABLE survey_instances; DROP TABLE survey_schemas;` (reverse order due to FK dependencies)

## GDPR Erasure

When a pseudonymous ID is deleted, all `survey_responses` rows matching `pseudonymous_id` must be deleted. The `idx_survey_responses_pseudo` index ensures this is efficient.

Erasure must complete within the 30-day SLA defined in the MHG data model.
