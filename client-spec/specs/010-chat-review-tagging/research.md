# Research: User & Chat Tagging for Review Filtering

**Feature Branch**: `010-chat-review-tagging`
**Date**: 2026-02-10

## Research Summary

This feature extends the existing review system (spec 002) with tagging and exclusion capabilities. The review system is already substantially scaffolded. Research focuses on data model design for tags, exclusion evaluation strategy, UI component patterns for tag interaction, and migration strategy.

---

## R1: Tag Data Model — Single vs Separate Tables

**Decision**: Use a single `tag_definitions` table as the master registry with separate junction tables (`user_tags` and `session_tags`) for the two assignment contexts.

**Rationale**: The spec defines a shared namespace (clarification: tag names are globally unique across user and chat categories). A single `tag_definitions` table enforces this naturally with a unique constraint on `name`. Junction tables are needed because the relationships are many-to-many (a user can have many tags, a tag can be on many users; likewise for sessions).

**Alternatives considered**:
- Separate `user_tag_definitions` and `chat_tag_definitions` tables → Rejected: complicates shared namespace enforcement; requires cross-table uniqueness which PostgreSQL doesn't support natively
- Single polymorphic `tag_assignments` table with `target_type` and `target_id` → Rejected: loses FK integrity (can't reference both `users` and `sessions` from one FK column); separate junction tables are cleaner and allow specific indexes
- JSONB array on `users` and `sessions` tables → Rejected: poor queryability for filtering; no FK integrity; harder to enforce uniqueness

**Implementation**:

```sql
-- Master tag registry
CREATE TABLE tag_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    name_lower VARCHAR(100) NOT NULL GENERATED ALWAYS AS (LOWER(name)) STORED,
    description TEXT,
    category VARCHAR(10) NOT NULL CHECK (category IN ('user', 'chat')),
    exclude_from_reviews BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name_lower)  -- Enforces case-insensitive uniqueness globally
);

-- User-tag assignments (many-to-many)
CREATE TABLE user_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_definition_id UUID NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tag_definition_id)
);

-- Session-tag assignments (many-to-many)
CREATE TABLE session_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tag_definition_id UUID NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
    source VARCHAR(10) NOT NULL CHECK (source IN ('system', 'manual')),
    applied_by UUID REFERENCES users(id),  -- NULL for system-applied
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, tag_definition_id)
);
```

---

## R2: Session Exclusion Strategy — Query-Time vs Ingestion-Time

**Decision**: Evaluate exclusion at **session ingestion time** (when a completed session enters the review pipeline) and record the result in a `session_exclusions` table. The review queue query joins against this table to filter.

**Rationale**: Ingestion-time evaluation is simpler and more performant than query-time evaluation. At query time, checking "does this session's user have an exclusion tag?" would require joining through `user_tags → tag_definitions` for every queue query. By recording the exclusion decision at ingestion, the queue query only needs to check the `session_exclusions` table (a simple EXISTS subquery or LEFT JOIN).

The spec explicitly states that exclusion rules apply only to future sessions (FR-013), which aligns perfectly with ingestion-time evaluation — when a session arrives, the system checks current tag state and records the decision.

**Alternatives considered**:
- Query-time evaluation (check user tags on every queue fetch) → Rejected: slower queue queries at scale; harder to explain "why was this session excluded?" since the answer depends on current tag state, not state at time of exclusion
- Boolean `is_excluded` column on `sessions` table → Rejected: loses exclusion reason information; harder to implement "Excluded" view with reason display (FR-008)
- Materialized view → Rejected: adds refresh complexity; overkill for this volume

**Implementation**:

```sql
CREATE TABLE session_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,        -- Tag name that caused exclusion
    reason_source VARCHAR(10) NOT NULL CHECK (reason_source IN ('user_tag', 'chat_tag')),
    tag_definition_id UUID REFERENCES tag_definitions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- A session can have multiple exclusion reasons
CREATE INDEX idx_session_exclusions_session ON session_exclusions(session_id);
```

**Queue query modification**:

```sql
-- Default queue (exclude excluded sessions)
SELECT s.* FROM sessions s
WHERE NOT EXISTS (
    SELECT 1 FROM session_exclusions se WHERE se.session_id = s.id
)
AND s.review_status IN ('pending_review', ...)
-- ...existing filters...

-- Excluded view
SELECT s.*, se.reason, se.reason_source FROM sessions s
INNER JOIN session_exclusions se ON se.session_id = s.id
-- ...date/tag filters...
```

---

## R3: Short Chat Detection — Message Counting Strategy

**Decision**: Count only messages with `role IN ('user', 'assistant')` in the `session_messages` table. System messages (`role = 'system'`) are excluded from the count per FR-014.

**Rationale**: The spec explicitly requires counting only user and AI messages. System messages (e.g., conversation prompts, context injections) don't represent meaningful conversational turns and should not inflate the message count.

**Implementation**: During session ingestion, the exclusion service queries:

```sql
SELECT COUNT(*) FROM session_messages
WHERE session_id = $1
AND role IN ('user', 'assistant');
```

If count < `review_configuration.min_message_threshold` (default 4), the session is tagged "short" and an exclusion record is created.

**Alternatives considered**:
- Cache message count on `sessions` table → May implement as optimization later, but the COUNT query is sufficient at current scale (sessions have typically 5-50 messages)
- Count only user messages (not AI) → Rejected: spec says "total messages from both user and AI combined"

---

## R4: Review Configuration Extension — Min Message Threshold

**Decision**: Add `min_message_threshold` column to the existing `review_configuration` singleton table (migration 015).

**Rationale**: The threshold is a system-wide admin-configurable value (FR-006, spec Assumptions). It belongs alongside other review configuration settings like `min_reviews`, `variance_limit`, etc. in the same singleton row.

**Implementation**:

```sql
ALTER TABLE review_configuration
    ADD COLUMN min_message_threshold SMALLINT NOT NULL DEFAULT 4;
```

Update `ReviewConfiguration` type in `chat-types/src/reviewConfig.ts`:

```typescript
export interface ReviewConfiguration {
    // ...existing fields...
    minMessageThreshold: number;  // NEW
}

export const DEFAULT_REVIEW_CONFIG: ReviewConfiguration = {
    // ...existing defaults...
    minMessageThreshold: 4,  // NEW
};
```

**Alternatives considered**:
- Separate config table for tagging settings → Rejected: only one setting; doesn't justify a new table
- Hardcoded threshold → Rejected: spec explicitly requires admin configurability (FR-006)

---

## R5: UI Component — Tag Filter in Review Queue

**Decision**: Implement a multi-select combobox (similar to GitHub labels picker) for the tag filter, using the existing design patterns in the review queue filter panel.

**Rationale**: The review queue already has filter controls (status, risk level, date range, assignment, language). The tag filter integrates as another filter option in the same panel. A combobox supports both selection from existing tags and (for moderators on session detail) creating new tags.

**Component breakdown**:
1. **`TagFilter.tsx`** — Multi-select dropdown for the queue filter panel. Shows all tag names with checkboxes. Selected tags filter the queue (AND logic with other filters per FR-016).
2. **`TagBadge.tsx`** — Small colored chip displaying a tag name. Used on `SessionCard` and session detail view. Includes an "x" button for removal when the user has permission.
3. **`TagInput.tsx`** — Combobox for adding tags to sessions. Shows existing tags as dropdown options with a text input that also allows creating new tags (moderator only, per clarification). Uses debounced search.
4. **`ExcludedTab.tsx`** — New tab in the review queue showing excluded sessions with exclusion reasons.

**Alternatives considered**:
- Freeform text field for tag filter → Rejected: error-prone; users need to know exact tag names
- Separate page for excluded sessions → Rejected: spec describes it as a tab/view within the existing queue (US3 AS4)
- Tag cloud visualization → Rejected: over-designed for the expected tag count (10s of tags)

---

## R6: RBAC Permission Extension

**Decision**: Add three new permissions to the existing RBAC system: `TAG_MANAGE`, `TAG_ASSIGN_USER`, `TAG_ASSIGN_SESSION`.

**Rationale**: Tag operations require fine-grained permissions:
- `TAG_MANAGE` — Create, edit, delete tag definitions (admin only)
- `TAG_ASSIGN_USER` — Assign/remove tags on user accounts (moderator + admin)
- `TAG_ASSIGN_SESSION` — Add/remove tags on chat sessions (moderator + admin)

**Role mapping** (extends existing `ROLE_PERMISSIONS` in `chat-types/src/rbac.ts`):

| Permission | QA_SPECIALIST (Reviewer) | RESEARCHER (Senior) | MODERATOR | GROUP_ADMIN (Commander) | OWNER (Admin) |
|---|---|---|---|---|---|
| `TAG_MANAGE` | No | No | No | No | Yes |
| `TAG_ASSIGN_USER` | No | No | Yes | Yes | Yes |
| `TAG_ASSIGN_SESSION` | No | No | Yes | Yes | Yes |

**Alternatives considered**:
- Reuse existing `REVIEW_CONFIGURE` for all tag operations → Rejected: too broad; moderators need tag assignment but not tag definition management
- Single `TAG_ACCESS` permission → Rejected: doesn't differentiate between viewing and modifying; spec gives different roles different capabilities

---

## R7: Predefined Tag Seeding

**Decision**: Seed the "functional QA" tag definition in migration 015 as a predefined tag with `exclude_from_reviews = true` and `category = 'user'`.

**Rationale**: FR-002 requires a predefined "functional QA" tag. Seeding it in the migration ensures it exists on fresh installations and after any environment reset, without requiring manual admin setup.

**Implementation**:

```sql
INSERT INTO tag_definitions (name, name_lower, description, category, exclude_from_reviews, is_active)
VALUES ('functional QA', 'functional qa', 'Tag for test/QA user accounts whose sessions should be excluded from the review queue', 'user', true, true);
```

Also seed the "short" tag:

```sql
INSERT INTO tag_definitions (name, name_lower, description, category, exclude_from_reviews, is_active)
VALUES ('short', 'short', 'Auto-applied to chat sessions with fewer messages than the configured minimum threshold', 'chat', true, true);
```

**Alternatives considered**:
- Create via admin UI during initial setup → Rejected: spec says predefined; must exist without manual intervention
- Create in application startup code → Rejected: migration is idempotent and standard; application startup seeding can have race conditions

---

## R8: Audit Logging for Tag Operations

**Decision**: Reuse the existing `audit_log` table and extend the `targetType` values to include `'tag_definition'`, `'user_tag'`, and `'session_tag'`.

**Rationale**: The spec assumes tag changes are audit-logged through existing infrastructure (spec Assumptions). The `audit_log` table from spec 002 already supports extensible target types. Adding tag-related types follows the same pattern as R4 in spec 002 research.

**Events to log**:

| Action | Target Type | Details |
|--------|-------------|---------|
| `tag_definition.create` | `tag_definition` | `{ name, category, excludeFromReviews }` |
| `tag_definition.update` | `tag_definition` | `{ changes: { field: { old, new } } }` |
| `tag_definition.delete` | `tag_definition` | `{ name, affectedUsers: count, affectedSessions: count }` |
| `user_tag.assign` | `user_tag` | `{ userId, tagName }` |
| `user_tag.remove` | `user_tag` | `{ userId, tagName }` |
| `session_tag.apply` | `session_tag` | `{ sessionId, tagName, source }` |
| `session_tag.remove` | `session_tag` | `{ sessionId, tagName }` |

**Alternatives considered**:
- Separate `tag_audit_log` table → Rejected: duplicates infrastructure; the existing audit log pattern works
- Skip audit logging for tag operations → Rejected: spec explicitly requires it (Assumptions section)

---

## R9: i18n Strategy for Tag Labels

**Decision**: Tag names are user-defined freeform strings and are NOT translated. All UI chrome (labels, buttons, tooltips, error messages) around tags is translated in uk/en/ru via existing i18n infrastructure.

**Rationale**: Tag names like "functional QA", "short", "training-example" are operational labels created by admins/moderators. Translating them would require a translation table per tag, which is overengineered for operational labels. Constitution VI requires i18n for "all user-visible text" — this applies to UI labels ("Tags", "Add Tag", "Excluded Sessions", etc.) but not to user-generated content.

**New i18n keys** (added to `review.json` in en/uk/ru):

```json
{
  "tags": {
    "title": "Tags",
    "filter": "Filter by tags",
    "addTag": "Add tag",
    "removeTag": "Remove tag",
    "createNew": "Create new tag",
    "noTags": "No tags assigned",
    "excluded": "Excluded",
    "excludedSessions": "Excluded Sessions",
    "exclusionReason": "Exclusion reason",
    "tagManagement": "Tag Management",
    "tagName": "Tag name",
    "tagDescription": "Description",
    "excludeFromReviews": "Exclude from reviews",
    "active": "Active",
    "inactive": "Inactive",
    "duplicateError": "A tag with this name already exists",
    "assignTag": "Assign tag",
    "unassignTag": "Remove tag",
    "short": "Short chat",
    "shortDescription": "This chat has fewer than {{threshold}} messages"
  }
}
```

**Alternatives considered**:
- Translate tag names via a mapping table → Rejected: overengineered; admin-created labels don't need i18n
- Store tags in all three languages → Rejected: triples admin effort for minimal gain

---

## R10: Migration Numbering

**Decision**: Use migration number `015` for the tagging system migration.

**Rationale**: Migration `013_add_review_system.sql` exists (spec 002 base). Migration `014_update_review_defaults_and_notification_status.sql` is planned for spec 002 updates. The next sequential number is 015.

**Implementation**: File `015_add_tagging_system.sql` in `chat-backend/src/db/migrations/`.
