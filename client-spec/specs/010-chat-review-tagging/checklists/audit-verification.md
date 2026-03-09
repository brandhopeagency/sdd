# Audit Logging Verification: Chat Review Tagging

**Feature Branch**: `010-chat-review-tagging`
**Date**: 2026-02-10
**Purpose**: Verify that all tag-related operations produce correct audit log entries.

## Audit Event Inventory

All tag operations must be logged to the `audit_log` table (per spec 002, FR-012). The following events should be verified:

### 1. Tag Definition Events

| Operation | `action` | `target_type` | `target_id` | `details` (expected keys) |
|-----------|----------|---------------|-------------|---------------------------|
| Create tag definition | `create` | `tag_definition` | New tag UUID | `name`, `category`, `excludeFromReviews` |
| Update tag definition | `update` | `tag_definition` | Tag UUID | Changed fields (before/after or new values) |
| Delete tag definition | `delete` | `tag_definition` | Tag UUID | `name`, `affectedUsers`, `affectedSessions` |

### 2. User Tag Events

| Operation | `action` | `target_type` | `target_id` | `details` (expected keys) |
|-----------|----------|---------------|-------------|---------------------------|
| Assign tag to user | `assign` | `user_tag` | UserTag UUID | `userId`, `tagDefinitionId`, `tagName` |
| Remove tag from user | `remove` | `user_tag` | UserTag UUID | `userId`, `tagDefinitionId`, `tagName` |

### 3. Session Tag Events

| Operation | `action` | `target_type` | `target_id` | `details` (expected keys) |
|-----------|----------|---------------|-------------|---------------------------|
| Apply tag to session (manual) | `apply` | `session_tag` | SessionTag UUID | `sessionId`, `tagDefinitionId`, `tagName`, `source: 'manual'` |
| Apply tag to session (system) | `apply` | `session_tag` | SessionTag UUID | `sessionId`, `tagDefinitionId`, `tagName`, `source: 'system'` |
| Remove tag from session | `remove` | `session_tag` | SessionTag UUID | `sessionId`, `tagDefinitionId`, `tagName` |

## Verification SQL Queries

### Count all tag-related audit events

```sql
SELECT action, target_type, COUNT(*)
FROM audit_log
WHERE target_type IN ('tag_definition', 'user_tag', 'session_tag')
GROUP BY action, target_type
ORDER BY target_type, action;
```

### Verify tag definition create events

```sql
SELECT
    al.id,
    al.action,
    al.target_type,
    al.target_id,
    al.user_id AS performed_by,
    al.details,
    al.created_at
FROM audit_log al
WHERE al.target_type = 'tag_definition'
  AND al.action = 'create'
ORDER BY al.created_at DESC
LIMIT 10;
```

### Verify user tag assign/remove events

```sql
SELECT
    al.id,
    al.action,
    al.target_type,
    al.target_id,
    al.user_id AS performed_by,
    al.details ->> 'userId' AS tagged_user,
    al.details ->> 'tagName' AS tag_name,
    al.created_at
FROM audit_log al
WHERE al.target_type = 'user_tag'
ORDER BY al.created_at DESC
LIMIT 20;
```

### Verify session tag apply/remove events

```sql
SELECT
    al.id,
    al.action,
    al.target_type,
    al.target_id,
    al.user_id AS performed_by,
    al.details ->> 'sessionId' AS session_id,
    al.details ->> 'tagName' AS tag_name,
    al.details ->> 'source' AS tag_source,
    al.created_at
FROM audit_log al
WHERE al.target_type = 'session_tag'
ORDER BY al.created_at DESC
LIMIT 20;
```

### Verify system-applied "short" tags are logged

```sql
SELECT COUNT(*) AS short_tag_audit_count
FROM audit_log al
WHERE al.target_type = 'session_tag'
  AND al.action = 'apply'
  AND al.details ->> 'tagName' = 'short'
  AND al.details ->> 'source' = 'system';
```

### Cross-reference: audit log vs actual tag assignments

```sql
-- User tags with audit records
SELECT
    ut.id AS user_tag_id,
    td.name AS tag_name,
    ut.user_id,
    ut.created_at AS assigned_at,
    (SELECT COUNT(*) FROM audit_log al
     WHERE al.target_type = 'user_tag'
       AND al.action = 'assign'
       AND al.target_id = ut.id::text) AS audit_records
FROM user_tags ut
JOIN tag_definitions td ON td.id = ut.tag_definition_id
ORDER BY ut.created_at DESC
LIMIT 20;
```

```sql
-- Session tags with audit records
SELECT
    st.id AS session_tag_id,
    td.name AS tag_name,
    st.session_id,
    st.source,
    st.created_at AS applied_at,
    (SELECT COUNT(*) FROM audit_log al
     WHERE al.target_type = 'session_tag'
       AND al.action = 'apply'
       AND al.target_id = st.id::text) AS audit_records
FROM session_tags st
JOIN tag_definitions td ON td.id = st.tag_definition_id
ORDER BY st.created_at DESC
LIMIT 20;
```

## Verification Checklist

- [ ] **Tag definition create**: Creating a tag via `POST /api/admin/tags` produces an audit entry with `action='create'`, `target_type='tag_definition'`
- [ ] **Tag definition update**: Updating via `PUT /api/admin/tags/:id` produces `action='update'`, `target_type='tag_definition'`
- [ ] **Tag definition delete**: Deleting via `DELETE /api/admin/tags/:id` produces `action='delete'`, `target_type='tag_definition'` with affected counts in details
- [ ] **User tag assign**: Assigning via `POST /api/admin/users/:id/tags` produces `action='assign'`, `target_type='user_tag'`
- [ ] **User tag remove**: Removing via `DELETE /api/admin/users/:id/tags/:tagId` produces `action='remove'`, `target_type='user_tag'`
- [ ] **Session tag apply (manual)**: Adding via `POST /api/review/sessions/:id/tags` with a tagDefinitionId produces `action='apply'`, `target_type='session_tag'`, `source='manual'`
- [ ] **Session tag apply (ad-hoc)**: Adding via `POST /api/review/sessions/:id/tags` with a tagName (new) produces both a `tag_definition` create event and a `session_tag` apply event
- [ ] **Session tag apply (system)**: Session ingestion auto-tagging "short" produces `action='apply'`, `target_type='session_tag'`, `source='system'`
- [ ] **Session tag remove**: Removing via `DELETE /api/review/sessions/:id/tags/:tagId` produces `action='remove'`, `target_type='session_tag'`
- [ ] **Performer identity**: All audit entries have the correct `user_id` (the admin/moderator who performed the action; NULL for system actions)
- [ ] **Cross-reference**: Every user_tag and session_tag row has a corresponding audit_log entry
- [ ] **Tag name snapshot**: Audit log `details.tagName` matches the tag name at time of action (not the current name if renamed)
