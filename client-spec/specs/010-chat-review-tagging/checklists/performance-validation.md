# Performance Validation Plan: Chat Review Tagging

**Feature Branch**: `010-chat-review-tagging`
**Date**: 2026-02-10
**Purpose**: Validate that tagging features meet success criteria performance targets under realistic data volumes.

## Success Criteria Targets

| ID | Description | Target | Measurement |
|----|-------------|--------|-------------|
| SC-001 | Tag-based exclusion at session ingestion | < 1 second | Time from session completion to exclusion record creation |
| SC-004 | Tag filter response in review queue | < 1 second | API response time for `GET /api/review?tags=...` |
| SC-008 | Session tag add/remove | < 500 ms | API response time for `POST/DELETE /api/review/sessions/:id/tags` |

---

## Test Data Volume Requirements

To validate performance under realistic conditions, the test database should contain:

| Table | Minimum Rows | Description |
|-------|-------------|-------------|
| `sessions` | 10,000 | Mix of review statuses, message counts |
| `tag_definitions` | 20 | Mix of user/chat categories, active/inactive |
| `user_tags` | 200 | Multiple tags per user, ~50 unique users |
| `session_tags` | 5,000 | Mix of system/manual, ~500 unique sessions tagged |
| `session_exclusions` | 3,000 | Mix of user_tag/chat_tag reason sources |
| `review_configuration` | 1 | Singleton with `min_message_threshold = 4` |
| `users` | 500 | Realistic user base for user-tag joins |

### Data Generation SQL

```sql
-- Generate test tag definitions (if not already present)
INSERT INTO tag_definitions (name, description, category, exclude_from_reviews, is_active)
SELECT
    'perf-test-tag-' || i,
    'Performance test tag ' || i,
    CASE WHEN i % 2 = 0 THEN 'user' ELSE 'chat' END,
    CASE WHEN i <= 5 THEN true ELSE false END,
    true
FROM generate_series(1, 18) AS i
ON CONFLICT (name_lower) DO NOTHING;
```

---

## SQL EXPLAIN ANALYZE Queries

### 1. Tag-Based Exclusion Check (SC-001)

This query runs during session ingestion to determine if a session should be excluded.

```sql
-- User-tag exclusion check: does the session's user have an exclusion-eligible tag?
EXPLAIN ANALYZE
SELECT ut.id, td.name
FROM user_tags ut
JOIN tag_definitions td ON td.id = ut.tag_definition_id
WHERE ut.user_id = '<test-user-uuid>'
  AND td.exclude_from_reviews = true
  AND td.is_active = true
LIMIT 1;
```

**Expected plan**: Index scan on `idx_user_tags_user` → nested loop → index scan on `tag_definitions(id)`.
**Target**: < 1 ms execution time.

```sql
-- Short-chat exclusion check: count user+AI messages
EXPLAIN ANALYZE
SELECT COUNT(*) AS msg_count
FROM messages
WHERE session_id = '<test-session-uuid>'
  AND role IN ('user', 'assistant');
```

**Expected plan**: Index scan on `messages(session_id)` with filter on `role`.
**Target**: < 5 ms execution time.

```sql
-- Full exclusion evaluation (combined): write exclusion record
EXPLAIN ANALYZE
INSERT INTO session_exclusions (session_id, reason, reason_source, tag_definition_id)
SELECT
    '<test-session-uuid>',
    td.name,
    'user_tag',
    td.id
FROM user_tags ut
JOIN tag_definitions td ON td.id = ut.tag_definition_id
WHERE ut.user_id = '<test-user-uuid>'
  AND td.exclude_from_reviews = true
  AND td.is_active = true
ON CONFLICT DO NOTHING;
```

**Expected plan**: Subquery uses index scans; insert is O(1).
**Target**: < 5 ms total execution time.

### 2. Tag Filter in Review Queue (SC-004)

This query powers the filtered review queue with tag parameters.

```sql
-- Queue with tag filter (single tag)
EXPLAIN ANALYZE
SELECT s.id, s.review_status, s.created_at, s.message_count
FROM sessions s
JOIN session_tags st ON st.session_id = s.id
JOIN tag_definitions td ON td.id = st.tag_definition_id
WHERE td.name_lower = 'short'
  AND NOT EXISTS (
    SELECT 1 FROM session_exclusions se WHERE se.session_id = s.id
  )
ORDER BY s.created_at DESC
LIMIT 20 OFFSET 0;
```

**Expected plan**: Index scan on `idx_tag_definitions_name_lower` → index scan on `idx_session_tags_tag` → anti-join on `idx_session_exclusions_session`.
**Target**: < 50 ms execution time with 10K sessions.

```sql
-- Queue with tag filter (multiple tags)
EXPLAIN ANALYZE
SELECT s.id, s.review_status, s.created_at, s.message_count
FROM sessions s
WHERE EXISTS (
    SELECT 1
    FROM session_tags st
    JOIN tag_definitions td ON td.id = st.tag_definition_id
    WHERE st.session_id = s.id
      AND td.name_lower IN ('short', 'escalated')
)
  AND NOT EXISTS (
    SELECT 1 FROM session_exclusions se WHERE se.session_id = s.id
  )
ORDER BY s.created_at DESC
LIMIT 20 OFFSET 0;
```

**Expected plan**: Semi-join with index scans on session_tags and tag_definitions.
**Target**: < 100 ms execution time with 10K sessions.

```sql
-- Excluded sessions view
EXPLAIN ANALYZE
SELECT s.id, s.created_at, s.message_count,
       se.reason, se.reason_source, se.created_at AS excluded_at
FROM sessions s
JOIN session_exclusions se ON se.session_id = s.id
ORDER BY se.created_at DESC
LIMIT 20 OFFSET 0;
```

**Expected plan**: Index scan on `idx_session_exclusions_session` → join on `sessions(id)`.
**Target**: < 50 ms execution time with 3K exclusions.

### 3. Session Tag Add/Remove (SC-008)

```sql
-- Add tag to session
EXPLAIN ANALYZE
INSERT INTO session_tags (session_id, tag_definition_id, source, applied_by)
VALUES ('<test-session-uuid>', '<test-tag-uuid>', 'manual', '<test-user-uuid>');
```

**Expected plan**: Direct insert with unique constraint check.
**Target**: < 5 ms execution time.

```sql
-- Remove tag from session
EXPLAIN ANALYZE
DELETE FROM session_tags
WHERE session_id = '<test-session-uuid>'
  AND tag_definition_id = '<test-tag-uuid>'
  AND source = 'manual';
```

**Expected plan**: Index scan on `idx_session_tags_session_tag`.
**Target**: < 5 ms execution time.

```sql
-- Ad-hoc tag creation + session assignment (two operations)
EXPLAIN ANALYZE
INSERT INTO tag_definitions (name, description, category, exclude_from_reviews, is_active, created_by)
VALUES ('new-adhoc-tag', NULL, 'chat', false, true, '<test-user-uuid>')
RETURNING id;
-- Then: INSERT INTO session_tags ... (same as above)
```

**Expected plan**: Direct insert with unique constraint check on `name_lower`.
**Target**: < 10 ms total for both operations.

### 4. Filter Tags Listing (for dropdown population)

```sql
-- List tags with session counts (for TagFilter dropdown)
EXPLAIN ANALYZE
SELECT td.id, td.name, td.category, COUNT(st.id) AS session_count
FROM tag_definitions td
JOIN session_tags st ON st.tag_definition_id = td.id
WHERE td.is_active = true
GROUP BY td.id, td.name, td.category
HAVING COUNT(st.id) > 0
ORDER BY td.name;
```

**Expected plan**: Index scan on `idx_tag_definitions_active` → hash join with session_tags → group aggregate.
**Target**: < 50 ms execution time.

### 5. User Tag Filter (FR-015)

```sql
-- Filter users by assigned tag
EXPLAIN ANALYZE
SELECT u.id, u.email, u.display_name
FROM users u
JOIN user_tags ut ON ut.user_id = u.id
JOIN tag_definitions td ON td.id = ut.tag_definition_id
WHERE td.name_lower = 'functional qa'
ORDER BY u.display_name
LIMIT 50;
```

**Expected plan**: Index scan on `idx_tag_definitions_name_lower` → index scan on `idx_user_tags_tag` → join on `users(id)`.
**Target**: < 20 ms execution time with 500 users.

---

## API Response Time Validation

### Test Script (cURL)

```bash
# Set base URL and auth token
BASE_URL="http://localhost:8080/api"
TOKEN="<valid-jwt-token>"

# SC-001: Exclusion check is internal — measure via database query timing

# SC-004: Tag filter response time
echo "--- SC-004: Tag filter ---"
time curl -s -o /dev/null -w "%{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/review?tags=short&limit=20"

echo "--- SC-004: Excluded sessions ---"
time curl -s -o /dev/null -w "%{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/review?excluded=true&limit=20"

echo "--- SC-004: Multiple tag filter ---"
time curl -s -o /dev/null -w "%{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/review?tags=short,escalated&limit=20"

# SC-008: Session tag add
echo "--- SC-008: Add session tag ---"
time curl -s -o /dev/null -w "%{time_total}s\n" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tagDefinitionId":"<tag-uuid>"}' \
  "$BASE_URL/review/sessions/<session-uuid>/tags"

# SC-008: Remove session tag
echo "--- SC-008: Remove session tag ---"
time curl -s -o /dev/null -w "%{time_total}s\n" \
  -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/review/sessions/<session-uuid>/tags/<tag-uuid>"

# Filter tags listing
echo "--- Filter tags listing ---"
time curl -s -o /dev/null -w "%{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/review/tags"
```

### Pass/Fail Criteria

| Test | Target | Pass | Fail |
|------|--------|------|------|
| SC-001: Exclusion evaluation SQL | < 10 ms | ≤ 10 ms | > 10 ms |
| SC-001: End-to-end ingestion | < 1 s | ≤ 1000 ms | > 1000 ms |
| SC-004: Single tag filter API | < 1 s | ≤ 1000 ms | > 1000 ms |
| SC-004: Multiple tag filter API | < 1 s | ≤ 1000 ms | > 1000 ms |
| SC-004: Excluded sessions API | < 1 s | ≤ 1000 ms | > 1000 ms |
| SC-008: Add session tag API | < 500 ms | ≤ 500 ms | > 500 ms |
| SC-008: Remove session tag API | < 500 ms | ≤ 500 ms | > 500 ms |
| Filter tags listing API | < 1 s | ≤ 1000 ms | > 1000 ms |

---

## Index Verification

Confirm all required indexes exist:

```sql
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename IN ('tag_definitions', 'user_tags', 'session_tags', 'session_exclusions')
ORDER BY tablename, indexname;
```

Expected indexes:
- `tag_definitions`: `idx_tag_definitions_name_lower` (UNIQUE), `idx_tag_definitions_category`, `idx_tag_definitions_active`
- `user_tags`: `idx_user_tags_user_tag` (UNIQUE), `idx_user_tags_user`, `idx_user_tags_tag`
- `session_tags`: `idx_session_tags_session_tag` (UNIQUE), `idx_session_tags_session`, `idx_session_tags_tag`
- `session_exclusions`: `idx_session_exclusions_session`

---

## Results Template

| Test | Measured Time | Target | Status |
|------|--------------|--------|--------|
| SC-001: User-tag exclusion SQL | ___ ms | < 10 ms | |
| SC-001: Short-chat check SQL | ___ ms | < 5 ms | |
| SC-001: End-to-end ingestion | ___ ms | < 1000 ms | |
| SC-004: Single tag filter API | ___ ms | < 1000 ms | |
| SC-004: Multi-tag filter API | ___ ms | < 1000 ms | |
| SC-004: Excluded sessions API | ___ ms | < 1000 ms | |
| SC-008: Add tag API | ___ ms | < 500 ms | |
| SC-008: Remove tag API | ___ ms | < 500 ms | |
| Filter tags listing API | ___ ms | < 1000 ms | |
