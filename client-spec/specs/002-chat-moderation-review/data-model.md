# Data Model: Chat Moderation & Review System

**Feature Branch**: `002-chat-moderation-review`
**Date**: 2026-02-10
**Source**: Migration `013_add_review_system.sql` + `chat-types/src/review.ts` + `chat-types/src/reviewConfig.ts`

## Overview

The review data model extends the existing chat system with 9 new tables and session column extensions. All entities use UUIDs for primary keys (via `pgcrypto`) and follow the `BaseEntity` pattern (`id`, `createdAt`, `updatedAt`). The model is already implemented in migration 013; this document serves as the canonical reference and documents the planned migration 014 updates.

## Entity Relationship Diagram

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│     users        │    │      sessions         │    │  session_messages   │
│─────────────────│    │──────────────────────│    │─────────────────────│
│ id (PK)         │◄──┤ user_id (FK)          │──►│ session_id (FK)     │
│ email           │    │ review_status         │    │ id (PK)            │
│ display_name    │    │ review_final_score    │    │ role                │
│ role            │    │ review_count          │    │ content             │
│ status          │    │ reviews_required      │    └─────────┬───────────┘
└────────┬────────┘    │ risk_level            │              │
         │             │ language              │              │
         │             │ auto_flagged          │              │
         │             │ tiebreaker_reviewer_id│              │
         │             └──────────┬────────────┘              │
         │                        │                           │
         │         ┌──────────────┼──────────────┐            │
         │         │              │              │            │
         │         ▼              ▼              ▼            │
         │  ┌──────────────┐ ┌──────────┐ ┌────────────────┐ │
         │  │session_reviews│ │risk_flags │ │anonymous_      │ │
         │  │──────────────│ │──────────│ │mappings        │ │
         ├──│reviewer_id   │ │flagged_by│ │────────────────│ │
         │  │session_id    │ │session_id│ │real_user_id    │ │
         │  │status        │ │severity  │ │anonymous_id    │ │
         │  │is_tiebreaker │ │reason_cat│ │context_session │ │
         │  │average_score │ │status    │ └────────────────┘ │
         │  │config_snap   │ │notif_dlvr│                    │
         │  └──────┬───────┘ │sla_deadln│                    │
         │         │         └─────┬────┘                    │
         │         │               │                         │
         │         ▼               ▼                         │
         │  ┌──────────────┐ ┌──────────────────┐            │
         │  │message_ratings│ │deanonymization_  │            │
         │  │──────────────│ │requests          │            │
         │  │review_id (FK)│ │──────────────────│            │
         │  │message_id(FK)│─┤session_id        │            │
         │  │score (1-10)  │ │target_user_id    │            │
         │  │comment       │ │requester_id      │            │
         │  └──────┬───────┘ │approver_id       │            │
         │         │         │risk_flag_id      │            │
         │         ▼         │status            │            │
         │  ┌──────────────┐ │access_expires_at │            │
         │  │criteria_     │ └──────────────────┘            │
         │  │feedback      │                                 │
         │  │──────────────│                                 │
         │  │rating_id (FK)│                                 │
         │  │criterion     │                                 │
         │  │feedback_text │                                 │
         │  └──────────────┘                                 │
         │                                                   │
         ▼                                                   │
  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┘
  │review_            │  │crisis_keywords   │  │
  │notifications      │  │──────────────────│  │
  │──────────────────│  │keyword           │  │
  │recipient_id (FK) │  │language          │  │
  │event_type        │  │category          │  │
  │title / body      │  │severity          │  │
  │read_at           │  │is_phrase         │  │
  └──────────────────┘  │is_active         │  │
                        └──────────────────┘  │
  ┌──────────────────┐                        │
  │review_            │                        │
  │configuration      │                        │
  │──────────────────│                        │
  │id = 1 (singleton)│                        │
  │min_reviews       │                        │
  │max_reviews       │                        │
  │criteria_threshold│                        │
  │variance_limit    │                        │
  │timeout_hours     │                        │
  │deano_access_hours│                        │
  └──────────────────┘                        │
                                              │
  ┌──────────────────┐                        │
  │audit_log          │◄───────────────────────┘
  │──────────────────│  (extended target types)
  │actor_id          │
  │action            │
  │target_type       │
  │target_id         │
  │details (JSONB)   │
  │ip_address        │
  └──────────────────┘
```

## Entities

### 1. session_reviews

Per-reviewer assessment of a chat session.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique review identifier |
| `session_id` | UUID | FK → sessions(id), NOT NULL | Reviewed session |
| `reviewer_id` | UUID | FK → users(id), NOT NULL | Reviewing user |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','in_progress','completed','expired') | Review lifecycle state |
| `is_tiebreaker` | BOOLEAN | NOT NULL, DEFAULT false | Whether this is a tiebreaker review |
| `average_score` | DECIMAL(3,1) | NULLABLE | Average of all message ratings |
| `overall_comment` | TEXT | NULLABLE | General comments on the session |
| `started_at` | TIMESTAMPTZ | NULLABLE | When reviewer began reviewing |
| `completed_at` | TIMESTAMPTZ | NULLABLE | When review was submitted |
| `expires_at` | TIMESTAMPTZ | NULLABLE | Assignment expiration time |
| `config_snapshot` | JSONB | NULLABLE | Frozen config at review creation time |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**Unique**: `(session_id, reviewer_id)` — prevents duplicate reviews.

**Indexes**: `(session_id, status)`, `(reviewer_id, status)`, `(expires_at)` WHERE status IN ('pending','in_progress').

**State transitions**:

```
pending → in_progress  (reviewer opens session)
in_progress → completed (reviewer submits)
pending → expired      (24h timeout, unstarted)
in_progress → expired  (24h timeout, incomplete)
```

### 2. message_ratings

Per-message score within a review.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique rating identifier |
| `review_id` | UUID | FK → session_reviews(id) ON DELETE CASCADE, NOT NULL | Parent review |
| `message_id` | UUID | FK → session_messages(id), NOT NULL | Rated AI message |
| `score` | SMALLINT | NOT NULL, CHECK (1-10) | Rating score |
| `comment` | TEXT | NULLABLE | Optional comment |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**Unique**: `(review_id, message_id)` — one rating per message per review.

**Validation rules**:
- Score 1-10 enforced at DB level
- When score ≤ `config.criteriaThreshold` (default 7), at least one `criteria_feedback` row required (enforced at service level)
- Score ≤ 2 triggers automatic moderator escalation (FR-018)
- Score ≤ `config.autoFlagThreshold` (default 4) triggers auto-flag for moderator review (FR-025)

### 3. criteria_feedback

Structured feedback per evaluation criterion.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique feedback identifier |
| `rating_id` | UUID | FK → message_ratings(id) ON DELETE CASCADE, NOT NULL | Parent rating |
| `criterion` | VARCHAR(20) | NOT NULL, CHECK IN ('relevance','empathy','safety','ethics','clarity') | Evaluation criterion |
| `feedback_text` | TEXT | NOT NULL, CHECK LENGTH ≥ 10 | Detailed feedback (min 10 chars) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |

**Unique**: `(rating_id, criterion)` — one feedback per criterion per rating.

### 4. risk_flags

Safety/compliance flags on sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique flag identifier |
| `session_id` | UUID | FK → sessions(id), NOT NULL | Flagged session |
| `flagged_by` | UUID | FK → users(id), NULLABLE | Flagging reviewer (NULL for auto-detected) |
| `severity` | VARCHAR(10) | NOT NULL, CHECK IN ('high','medium','low') | Risk severity |
| `reason_category` | VARCHAR(30) | NOT NULL | Reason category from enum |
| `details` | TEXT | NOT NULL | Supporting details |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'open', CHECK IN ('open','acknowledged','resolved','escalated') | Flag lifecycle |
| `assigned_moderator_id` | UUID | FK → users(id), NULLABLE | Assigned moderator |
| `resolution_notes` | TEXT | NULLABLE | Resolution details |
| `resolved_by` | UUID | FK → users(id), NULLABLE | Resolver |
| `resolved_at` | TIMESTAMPTZ | NULLABLE | Resolution time |
| `deanonymization_requested` | BOOLEAN | NOT NULL, DEFAULT false | Whether deano was requested |
| `is_auto_detected` | BOOLEAN | NOT NULL, DEFAULT false | Auto-detected vs manual |
| `matched_keywords` | TEXT[] | NULLABLE | Matched crisis keywords (for auto) |
| `sla_deadline` | TIMESTAMPTZ | NULLABLE | SLA deadline for response |
| `notification_delivery_status` | VARCHAR(10) | DEFAULT 'pending', CHECK IN ('delivered','pending','failed') | **NEW (migration 014)** — notification delivery tracking |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**State transitions**:

```
open → acknowledged   (moderator acknowledges)
open → resolved       (direct resolution)
open → escalated      (escalated further)
acknowledged → resolved (resolved after review)
acknowledged → escalated (further escalation needed)
```

**SLA rules**:
- High severity: `sla_deadline = created_at + config.highRiskSlaHours` (default 2h)
- Medium severity: `sla_deadline = created_at + config.mediumRiskSlaHours` (default 24h)
- Low severity: No SLA (logged for weekly review)

### 5. deanonymization_requests

Controlled identity reveal workflow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique request identifier |
| `session_id` | UUID | FK → sessions(id), NOT NULL | Target session |
| `target_user_id` | UUID | FK → users(id), NOT NULL | User to reveal |
| `requester_id` | UUID | FK → users(id), NOT NULL | Requesting reviewer/moderator |
| `approver_id` | UUID | FK → users(id), NULLABLE | Approving commander/admin |
| `risk_flag_id` | UUID | FK → risk_flags(id), NULLABLE | Associated risk flag |
| `justification_category` | VARCHAR(30) | NOT NULL | Justification reason |
| `justification_details` | TEXT | NOT NULL | Supporting details |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','approved','denied') | Request status |
| `denial_notes` | TEXT | NULLABLE | Denial reasoning |
| `access_expires_at` | TIMESTAMPTZ | NULLABLE | When revealed data expires |
| `accessed_at` | TIMESTAMPTZ | NULLABLE | When data was first accessed |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**Access rules**:
- On approval: `access_expires_at = NOW() + config.deanonymizationAccessHours` (default 72h per spec clarification)
- After expiration: revealed data no longer accessible; expiration logged in audit
- All state transitions audit-logged (FR-012)

### 6. review_configuration

Singleton settings row.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | INTEGER | PK, CHECK (id = 1) | 1 | Singleton constraint |
| `min_reviews` | SMALLINT | NOT NULL | 3 | Minimum reviews per session |
| `max_reviews` | SMALLINT | NOT NULL | 5 | Maximum reviews per session |
| `criteria_threshold` | SMALLINT | NOT NULL | 7 | Score threshold requiring criteria feedback |
| `auto_flag_threshold` | SMALLINT | NOT NULL | 4 | Score threshold triggering auto-flag |
| `variance_limit` | DECIMAL(3,1) | NOT NULL | 2.0 | Max allowed score range before dispute |
| `timeout_hours` | SMALLINT | NOT NULL | 24 | Review assignment timeout |
| `high_risk_sla_hours` | SMALLINT | NOT NULL | 2 | High-risk escalation SLA |
| `medium_risk_sla_hours` | SMALLINT | NOT NULL | 24 | Medium-risk escalation SLA |
| `deanonymization_access_hours` | SMALLINT | NOT NULL | **72** (updated from 24 in migration 014) | Deanonymization access window |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | | Last config change |
| `updated_by` | UUID | FK → users(id), NULLABLE | | Who changed config |

### 7. crisis_keywords

Auto-detection keyword dictionary.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PK | Auto-increment ID |
| `keyword` | TEXT | NOT NULL | Keyword or phrase |
| `language` | VARCHAR(5) | NOT NULL | Language code (en, uk, ru) |
| `category` | VARCHAR(30) | NOT NULL, CHECK IN ('suicidal_ideation','self_harm','violence','other') | Crisis category |
| `severity` | VARCHAR(10) | NOT NULL, DEFAULT 'high', CHECK IN ('high','medium') | Severity level |
| `is_phrase` | BOOLEAN | NOT NULL, DEFAULT false | Whether multi-word phrase |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Active/disabled |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |

**Seeded data**: 42 keywords across English, Ukrainian, and Russian (see migration 013).

### 8. anonymous_mappings

Real-to-anonymous identity mapping.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Mapping identifier |
| `real_user_id` | UUID | NOT NULL | Actual user ID |
| `anonymous_id` | VARCHAR(10) | NOT NULL | Anonymous identifier (USER-XXXX) |
| `context_session_id` | UUID | FK → sessions(id), NOT NULL | Session context |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |

**Unique**: `(real_user_id, context_session_id)` — deterministic mapping within session.

### 9. review_notifications

In-app notification queue.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Notification identifier |
| `recipient_id` | UUID | FK → users(id), NOT NULL | Target user |
| `event_type` | VARCHAR(30) | NOT NULL | Event type from enum |
| `title` | TEXT | NOT NULL | Notification title |
| `body` | TEXT | NOT NULL | Notification body text |
| `data` | JSONB | NULLABLE | Additional context data |
| `read_at` | TIMESTAMPTZ | NULLABLE | When read (NULL = unread) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |

**Indexes**: `(recipient_id, read_at)` WHERE read_at IS NULL (unread notifications).

### 10. sessions (extended columns)

Review-related columns added to existing `sessions` table.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `review_status` | VARCHAR(20) | 'pending_review' | Aggregate review status |
| `review_final_score` | DECIMAL(3,1) | NULL | Computed final score |
| `review_count` | SMALLINT | 0 | Number of completed reviews |
| `reviews_required` | SMALLINT | 3 | Required reviews (from config at creation) |
| `risk_level` | VARCHAR(10) | 'none' | Aggregate risk level |
| `language` | VARCHAR(5) | NULL | Session language |
| `auto_flagged` | BOOLEAN | false | Whether auto-flagged by crisis detection |
| `tiebreaker_reviewer_id` | UUID | NULL | Assigned tiebreaker reviewer |

## Migration 014 (New)

```sql
-- 014_update_review_defaults_and_notification_status.sql
BEGIN;

-- Update deanonymization access hours default to 72 (spec clarification)
ALTER TABLE review_configuration
    ALTER COLUMN deanonymization_access_hours SET DEFAULT 72;

UPDATE review_configuration
    SET deanonymization_access_hours = 72
    WHERE id = 1 AND deanonymization_access_hours = 24;

-- Add notification delivery status to risk_flags (FR-026)
ALTER TABLE risk_flags
    ADD COLUMN IF NOT EXISTS notification_delivery_status VARCHAR(10)
    DEFAULT 'pending'
    CHECK (notification_delivery_status IN ('delivered', 'pending', 'failed'));

-- Extend audit_log target_type CHECK constraint for review types
-- (Only if audit_log has a CHECK constraint on target_type — verify in existing schema)

COMMIT;
```
