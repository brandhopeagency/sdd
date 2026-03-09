# Data Model: User & Chat Tagging for Review Filtering

**Feature Branch**: `010-chat-review-tagging`
**Date**: 2026-02-10
**Source**: Spec `010-chat-review-tagging/spec.md` + Research R1, R2, R4, R7

## Overview

The tagging data model adds 4 new tables and 1 column extension to the existing review system. All entities use UUIDs for primary keys (via `pgcrypto`). The model enforces a shared namespace for tag names (globally unique, case-insensitive) as per spec clarification.

## Entity Relationship Diagram

```
┌──────────────┐          ┌──────────────────┐          ┌─────────────────┐
│    users     │          │  tag_definitions  │          │    sessions     │
│──────────────│          │──────────────────│          │─────────────────│
│ id (PK)      │◄────┐    │ id (PK)          │    ┌────►│ id (PK)         │
│ email        │     │    │ name             │    │     │ review_status   │
│ display_name │     │    │ name_lower (GEN) │    │     │ message_count   │
│ role         │     │    │ description      │    │     │ ...             │
└──────┬───────┘     │    │ category         │    │     └────────┬────────┘
       │             │    │ exclude_from_revs │    │              │
       │             │    │ is_active         │    │              │
       │             │    │ created_by (FK)───┘    │              │
       │             │    │ created_at        │    │              │
       │             │    │ updated_at        │    │              │
       │             │    └────────┬──────────┘    │              │
       │             │             │               │              │
       │    ┌────────┴─────┐      │     ┌─────────┴──────────┐   │
       │    │  user_tags   │      │     │   session_tags      │   │
       │    │──────────────│      │     │────────────────────│   │
       │    │ id (PK)      │      │     │ id (PK)            │   │
       ├───►│ user_id (FK) │      │     │ session_id (FK)────┘   │
       │    │ tag_def_id   │◄─────┤     │ tag_def_id (FK)───┘    │
       │    │ (FK)         │      │     │ source             │   │
       │    │ assigned_by  │      │     │ applied_by (FK)    │   │
       │    │ (FK)─────────┘      │     │ created_at         │   │
       │    │ created_at   │      │     └────────────────────┘   │
       │    └──────────────┘      │                              │
       │                          │                              │
       │                          │     ┌────────────────────┐   │
       │                          │     │ session_exclusions │   │
       │                          │     │────────────────────│   │
       │                          └────►│ id (PK)            │   │
       │                                │ session_id (FK)────┘   │
       │                                │ reason              │
       │                                │ reason_source       │
       │                                │ tag_def_id (FK)     │
       │                                │ created_at          │
       │                                └────────────────────┘
       │
       ▼
┌──────────────────┐
│ review_           │
│ configuration     │
│──────────────────│
│ ...existing...   │
│ min_message_     │  ← NEW COLUMN
│ threshold (4)    │
└──────────────────┘
```

## Entities

### 1. tag_definitions

Master registry for all tags (user tags and chat tags in a shared namespace).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique tag identifier |
| `name` | VARCHAR(100) | NOT NULL | Display name (original casing) |
| `name_lower` | VARCHAR(100) | NOT NULL, GENERATED ALWAYS AS (LOWER(name)) STORED, UNIQUE | Lowercase name for case-insensitive uniqueness |
| `description` | TEXT | NULLABLE | Optional tag description |
| `category` | VARCHAR(10) | NOT NULL, CHECK IN ('user', 'chat') | Tag category |
| `exclude_from_reviews` | BOOLEAN | NOT NULL, DEFAULT false | Whether this tag triggers review exclusion |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true | Soft-delete / deactivation flag |
| `created_by` | UUID | FK → users(id), NULLABLE | Creator (NULL for migration-seeded) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**Indexes**: `(name_lower)` UNIQUE, `(category)`, `(is_active)`.

**Seed data** (migration 015):
- `('functional QA', 'functional qa', 'Test/QA user accounts...', 'user', true, true)`
- `('short', 'short', 'Auto-applied to short chats...', 'chat', true, true)`

**Validation rules**:
- Name must be 1-100 characters, non-empty after trimming
- Name must be unique case-insensitively across ALL categories (shared namespace)
- Category determines where the tag can be assigned: `'user'` → user_tags, `'chat'` → session_tags
- Only admins can set `exclude_from_reviews = true`; moderator-created ad-hoc tags default to `false`

### 2. user_tags

Junction table for user-to-tag assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Assignment identifier |
| `user_id` | UUID | FK → users(id) ON DELETE CASCADE, NOT NULL | Tagged user |
| `tag_definition_id` | UUID | FK → tag_definitions(id) ON DELETE CASCADE, NOT NULL | Applied tag |
| `assigned_by` | UUID | FK → users(id), NOT NULL | Who assigned the tag |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Assignment time |

**Unique**: `(user_id, tag_definition_id)` — a tag can only be assigned to a user once.

**Indexes**: `(user_id)`, `(tag_definition_id)`.

**Validation rules**:
- Tag definition must have `category = 'user'`
- Assigner must have `TAG_ASSIGN_USER` permission
- Tag definition must be active (`is_active = true`)

### 3. session_tags

Junction table for session-to-tag assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Assignment identifier |
| `session_id` | UUID | FK → sessions(id) ON DELETE CASCADE, NOT NULL | Tagged session |
| `tag_definition_id` | UUID | FK → tag_definitions(id) ON DELETE CASCADE, NOT NULL | Applied tag |
| `source` | VARCHAR(10) | NOT NULL, CHECK IN ('system', 'manual') | How the tag was applied |
| `applied_by` | UUID | FK → users(id), NULLABLE | Who applied (NULL for system) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Application time |

**Unique**: `(session_id, tag_definition_id)` — a tag can only be applied to a session once.

**Indexes**: `(session_id)`, `(tag_definition_id)`, `(source)`.

**Validation rules**:
- For `source = 'manual'`: tag definition must have `category = 'chat'`; applier must have `TAG_ASSIGN_SESSION` permission
- For `source = 'system'`: tag definition must have `category = 'chat'`; `applied_by` is NULL
- Tag definition must be active (`is_active = true`)

### 4. session_exclusions

Records documenting why a session was excluded from the review queue.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Exclusion record identifier |
| `session_id` | UUID | FK → sessions(id) ON DELETE CASCADE, NOT NULL | Excluded session |
| `reason` | VARCHAR(100) | NOT NULL | Tag name that caused exclusion |
| `reason_source` | VARCHAR(10) | NOT NULL, CHECK IN ('user_tag', 'chat_tag') | Source of exclusion |
| `tag_definition_id` | UUID | FK → tag_definitions(id) ON DELETE SET NULL, NULLABLE | Reference to tag (SET NULL on tag deletion) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Exclusion time |

**Indexes**: `(session_id)`.

**Notes**:
- A session can have multiple exclusion records (e.g., both "functional QA" user and "short" session)
- `reason` stores the tag name at time of exclusion (immutable snapshot) while `tag_definition_id` is a live reference
- On tag deletion, `tag_definition_id` becomes NULL but `reason` text is preserved for audit

### 5. review_configuration (extended)

New column added to existing singleton table.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `min_message_threshold` | SMALLINT | NOT NULL | 4 | Minimum user+AI messages for review inclusion |

**Validation rules**:
- Must be ≥ 1 (at least 1 message required)
- Changes affect only newly ingested sessions (not retroactive)

## Migration 015

```sql
-- 015_add_tagging_system.sql
BEGIN;

-- 1. Tag definitions table (shared namespace)
CREATE TABLE IF NOT EXISTS tag_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    name_lower VARCHAR(100) NOT NULL GENERATED ALWAYS AS (LOWER(name)) STORED,
    description TEXT,
    category VARCHAR(10) NOT NULL CHECK (category IN ('user', 'chat')),
    exclude_from_reviews BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_definitions_name_lower
    ON tag_definitions(name_lower);
CREATE INDEX IF NOT EXISTS idx_tag_definitions_category
    ON tag_definitions(category);
CREATE INDEX IF NOT EXISTS idx_tag_definitions_active
    ON tag_definitions(is_active) WHERE is_active = true;

-- 2. User-tag assignments
CREATE TABLE IF NOT EXISTS user_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_definition_id UUID NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tags_user_tag
    ON user_tags(user_id, tag_definition_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_user
    ON user_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_tag
    ON user_tags(tag_definition_id);

-- 3. Session-tag assignments
CREATE TABLE IF NOT EXISTS session_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tag_definition_id UUID NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
    source VARCHAR(10) NOT NULL CHECK (source IN ('system', 'manual')),
    applied_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_tags_session_tag
    ON session_tags(session_id, tag_definition_id);
CREATE INDEX IF NOT EXISTS idx_session_tags_session
    ON session_tags(session_id);
CREATE INDEX IF NOT EXISTS idx_session_tags_tag
    ON session_tags(tag_definition_id);

-- 4. Session exclusion records
CREATE TABLE IF NOT EXISTS session_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    reason_source VARCHAR(10) NOT NULL CHECK (reason_source IN ('user_tag', 'chat_tag')),
    tag_definition_id UUID REFERENCES tag_definitions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_exclusions_session
    ON session_exclusions(session_id);

-- 5. Extend review_configuration with min message threshold
ALTER TABLE review_configuration
    ADD COLUMN IF NOT EXISTS min_message_threshold SMALLINT NOT NULL DEFAULT 4;

-- 6. Seed predefined tags
INSERT INTO tag_definitions (name, description, category, exclude_from_reviews, is_active)
VALUES
    ('functional QA', 'Tag for test/QA user accounts whose sessions should be excluded from the review queue', 'user', true, true),
    ('short', 'Auto-applied to chat sessions with fewer messages than the configured minimum threshold', 'chat', true, true)
ON CONFLICT (name_lower) DO NOTHING;

COMMIT;
```

## Type Definitions (chat-types)

### New file: `tags.ts`

```typescript
import { BaseEntity } from './entities';

export interface TagDefinition extends BaseEntity {
  name: string;
  nameLower: string;
  description: string | null;
  category: 'user' | 'chat';
  excludeFromReviews: boolean;
  isActive: boolean;
  createdBy: string | null;
}

export interface UserTag extends BaseEntity {
  userId: string;
  tagDefinitionId: string;
  assignedBy: string;
  // Populated on read
  tagDefinition?: TagDefinition;
}

export interface SessionTag extends BaseEntity {
  sessionId: string;
  tagDefinitionId: string;
  source: 'system' | 'manual';
  appliedBy: string | null;
  // Populated on read
  tagDefinition?: TagDefinition;
}

export interface SessionExclusion extends BaseEntity {
  sessionId: string;
  reason: string;
  reasonSource: 'user_tag' | 'chat_tag';
  tagDefinitionId: string | null;
}

export interface CreateTagDefinitionInput {
  name: string;
  description?: string;
  category: 'user' | 'chat';
  excludeFromReviews?: boolean;
}

export interface UpdateTagDefinitionInput {
  name?: string;
  description?: string;
  excludeFromReviews?: boolean;
  isActive?: boolean;
}
```

### Modified: `reviewConfig.ts`

```typescript
export interface ReviewConfiguration {
  // ...existing fields...
  minMessageThreshold: number;
}

export const DEFAULT_REVIEW_CONFIG: ReviewConfiguration = {
  // ...existing defaults...
  minMessageThreshold: 4,
};
```

### Modified: `rbac.ts`

```typescript
// Add to ReviewPermission enum/const
export const REVIEW_PERMISSIONS = {
  // ...existing...
  TAG_MANAGE: 'TAG_MANAGE',
  TAG_ASSIGN_USER: 'TAG_ASSIGN_USER',
  TAG_ASSIGN_SESSION: 'TAG_ASSIGN_SESSION',
} as const;

// Add to ROLE_PERMISSIONS
ROLE_PERMISSIONS[UserRole.OWNER] = [
  ...existing,
  REVIEW_PERMISSIONS.TAG_MANAGE,
  REVIEW_PERMISSIONS.TAG_ASSIGN_USER,
  REVIEW_PERMISSIONS.TAG_ASSIGN_SESSION,
];

ROLE_PERMISSIONS[UserRole.MODERATOR] = [
  ...existing,
  REVIEW_PERMISSIONS.TAG_ASSIGN_USER,
  REVIEW_PERMISSIONS.TAG_ASSIGN_SESSION,
];

ROLE_PERMISSIONS[UserRole.GROUP_ADMIN] = [
  ...existing,
  REVIEW_PERMISSIONS.TAG_ASSIGN_USER,
  REVIEW_PERMISSIONS.TAG_ASSIGN_SESSION,
];
```

### Modified: `review.ts`

```typescript
// Add tag filter to queue query params
export interface ReviewQueueParams {
  // ...existing...
  tags?: string[];       // Filter by tag names
  excluded?: boolean;    // Show excluded sessions only
}
```
