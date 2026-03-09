# Data Model: Chat Review Supervision & Group Management Enhancements

**Feature**: `011-chat-review-supervision`  
**Date**: 2026-02-21

## Entity Overview

```
┌──────────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│  SessionReview   │────▶│  SupervisorReview     │────▶│  SupervisorReview │
│  (existing)      │  1:N│  (new)                │  0:N│  (revision chain) │
└──────────────────┘     └──────────────────────┘     └───────────────────┘
        │                         │
        │                         │
        ▼                         ▼
┌──────────────────┐     ┌──────────────────────┐
│  MessageRating   │     │  Users (supervisor)   │
│  (existing)      │     │  (new role)           │
└──────────────────┘     └──────────────────────┘
        │
        ▼
┌──────────────────┐
│ CriteriaFeedback │
│ (modified)       │
└──────────────────┘

┌──────────────────┐     ┌──────────────────────┐
│  ReviewConfig    │     │  GroupReviewConfig    │
│  (extended)      │     │  (new)               │
└──────────────────┘     └──────────────────────┘

┌──────────────────┐
│ GradeDescription │
│ (new)            │
└──────────────────┘
```

## New Entities

### SupervisorReview

A second-level evaluation of a reviewer's assessment by a supervisor.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| session_review_id | UUID | FK → session_reviews.id, NOT NULL | The reviewer assessment being evaluated |
| supervisor_id | UUID | FK → users.id, NOT NULL | The supervisor performing the evaluation |
| decision | VARCHAR(20) | NOT NULL, CHECK IN ('approved', 'disapproved') | Supervisor's decision |
| comments | TEXT | NOT NULL, min 1 char | Supervisor's written comments (mandatory) |
| return_to_reviewer | BOOLEAN | NOT NULL, DEFAULT false | Whether to send back for revision on disapproval |
| revision_iteration | INT | NOT NULL, DEFAULT 1, CHECK 1-3 | Which iteration this decision covers (1=initial, 2=first revision, 3=second revision) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Decision timestamp |

**Relationships**:
- Many-to-one with `session_reviews` (a review can have multiple supervisor decisions across revision iterations)
- Many-to-one with `users` (supervisor)

**Indexes**:
- `idx_supervisor_reviews_session_review_id` on `session_review_id`
- `idx_supervisor_reviews_supervisor_id` on `supervisor_id`
- `UNIQUE(session_review_id, revision_iteration)` — one supervisor decision per iteration

### GradeDescription

Editable description text for each score level (1-10) in the grading rubric.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| score_level | INT | PK, CHECK 1-10 | The score level (1 through 10) |
| description | TEXT | NOT NULL | Plain-language description of what this score level means |
| updated_by | UUID | FK → users.id, NULL | Last user who edited this description |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last edit timestamp |

**Relationships**:
- Many-to-one with `users` (last editor)

**Seed Data**: 10 rows seeded on migration with initial descriptions derived from existing `SCORE_LABELS` in `chat-types`.

### GroupReviewConfig

Per-group overrides for review configuration (reviewer count and supervision policy).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| group_id | UUID | FK → groups.id, NOT NULL, UNIQUE | The group this config applies to |
| reviewer_count_override | INT | NULL, CHECK >= 1 | Override for required reviewer count; NULL = use global default |
| supervision_policy | VARCHAR(20) | NULL, CHECK IN ('all', 'sampled', 'none') | Override supervision policy; NULL = use global default |
| supervision_sample_percentage | INT | NULL, CHECK 1-100 | Sampling rate when policy = 'sampled' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Relationships**:
- One-to-one with `groups`

**Behavior**: When a session enters the review queue, the system resolves the effective config by checking `group_review_config` first (for the session's group), falling back to global `review_config` for any NULL fields.

## Modified Entities

### SessionReview (existing — extended)

| New/Changed Field | Type | Constraints | Description |
|-------------------|------|-------------|-------------|
| supervision_status | VARCHAR(30) | NULL, CHECK IN ('pending_supervision', 'approved', 'disapproved', 'revision_requested', 'not_required') | Tracks where this review stands in the supervision pipeline |
| supervision_required | BOOLEAN | NOT NULL, DEFAULT false | Whether this review was selected for supervision per policy |

**State Transitions for `supervision_status`**:

```
Review Submitted
      │
      ▼
[supervision_required = true?]──── no ───▶ 'not_required' (review complete)
      │
     yes
      │
      ▼
'pending_supervision'
      │
      ├── Supervisor approves ───▶ 'approved' (review complete)
      │
      └── Supervisor disapproves
              │
              ├── return_to_reviewer = false ───▶ 'disapproved' (review closed)
              │
              └── return_to_reviewer = true ───▶ 'revision_requested'
                      │
                      ▼
              Reviewer revises & resubmits ───▶ 'pending_supervision'
                      │
                      (repeat up to 2 revisions max, then 'disapproved' + reassign)
```

### ReviewConfig (existing — extended)

| New/Changed Field | Type | Constraints | Description |
|-------------------|------|-------------|-------------|
| supervision_policy | VARCHAR(20) | NOT NULL, DEFAULT 'none' | Global default supervision policy: 'all', 'sampled', or 'none' |
| supervision_sample_percentage | INT | NOT NULL, DEFAULT 100 | Global default sampling rate when policy = 'sampled' |

### CriteriaFeedback (existing — validation change)

No schema changes. Behavioral change only:
- **Before**: When a message rating has score ≤ threshold, all 5 criteria required
- **After**: When a message rating has score ≤ threshold, at least 1 criterion required; `feedback_text` is optional per criterion

### Users (existing — new role value)

The `role` column (or `UserRole` enum) gains a new value: `supervisor`. Inserted between `researcher` and `moderator` in hierarchy ordering.

### TagDefinition (existing — permission change)

No schema changes. Behavioral change only:
- **Before**: Moderators and admins can create tag definitions; reviewers with `TAG_MANAGE` could create ad-hoc tags
- **After**: Tag creation requires `TAG_CREATE` permission (Supervisor+). Reviewers can only apply existing tags via `TAG_ASSIGN_SESSION` / `TAG_ASSIGN_USER`.

## New Types (chat-types)

### TypeScript Interfaces

```typescript
// SupervisorReview
interface SupervisorReview {
  id: string;
  sessionReviewId: string;
  supervisorId: string;
  decision: 'approved' | 'disapproved';
  comments: string;
  returnToReviewer: boolean;
  revisionIteration: number;
  createdAt: Date;
}

// Supervision decision input
interface SupervisorDecisionInput {
  decision: 'approved' | 'disapproved';
  comments: string;
  returnToReviewer?: boolean; // only relevant when decision = 'disapproved'
}

// Grade description
interface GradeDescription {
  scoreLevel: number;
  description: string;
  updatedBy: string | null;
  updatedAt: Date;
}

// Grade description update input
interface UpdateGradeDescriptionInput {
  description: string;
}

// Group review config
interface GroupReviewConfig {
  id: string;
  groupId: string;
  reviewerCountOverride: number | null;
  supervisionPolicy: SupervisionPolicy | null;
  supervisionSamplePercentage: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Supervision policy enum
type SupervisionPolicy = 'all' | 'sampled' | 'none';

// Supervision status for session reviews
type SupervisionStatus = 'pending_supervision' | 'approved' | 'disapproved' | 'revision_requested' | 'not_required';

// RAG call detail (embedded in message metadata)
interface RAGCallDetail {
  retrievalQuery: string;
  retrievedDocuments: RAGDocument[];
  retrievalTimestamp: Date;
}

interface RAGDocument {
  title: string;
  relevanceScore: number;
  contentSnippet: string;
}

// Supervision queue item
interface SupervisionQueueItem {
  sessionReviewId: string;
  sessionId: string;
  reviewerId: string;
  reviewerName: string;
  submittedAt: Date;
  revisionIteration: number;
  sessionMessageCount: number;
  groupName: string;
}
```

### New Permissions

```typescript
enum Permission {
  // ... existing permissions ...
  REVIEW_SUPERVISE = 'review:supervise',
  REVIEW_SUPERVISION_CONFIG = 'review:supervision_config',
  TAG_CREATE = 'tag:create',
}
```

### Updated Role Permissions

```typescript
const ROLE_PERMISSIONS = {
  // ... existing ...
  SUPERVISOR: [
    ...ROLE_PERMISSIONS.RESEARCHER,
    Permission.REVIEW_SUPERVISE,
    Permission.REVIEW_SUPERVISION_CONFIG,
    Permission.TAG_CREATE,
  ],
  MODERATOR: [
    ...existingModeratorPermissions,
    Permission.REVIEW_SUPERVISE,  // moderators can also supervise
    Permission.TAG_CREATE,
  ],
  // OWNER already has all permissions
};
```

## Database Migration Order

1. `xxx_add_supervisor_role.sql` — Add 'supervisor' to user role enum
2. `xxx_add_grade_descriptions.sql` — Create `grade_descriptions` table + seed 10 rows
3. `xxx_add_group_review_config.sql` — Create `group_review_config` table
4. `xxx_extend_review_config_supervision.sql` — Add supervision columns to `review_config`
5. `xxx_extend_session_reviews_supervision.sql` — Add `supervision_status`, `supervision_required` to `session_reviews`
6. `xxx_add_supervisor_reviews.sql` — Create `supervisor_reviews` table
