# Research: Group Chats Not Reflected in Group Sessions Interface

**Branch**: `main` | **Date**: 2026-02-24 | **Type**: Production Bugfix

## Problem Statement

Users added to groups in production have their chat sessions invisible in
the group chats (sessions) interface. Group admins viewing group sessions
see an empty or incomplete list, missing chats from group members.

## Root Cause Analysis

### Data Flow (Happy Path — Expected)

1. User is added to a group → `users.active_group_id` is set
2. User starts a chat session → `getGroupIdForUserId()` reads
   `COALESCE(active_group_id, group_id)` → returns group UUID
3. Session is persisted with `sessions.group_id = <group UUID>`
4. Group admin queries sessions → `WHERE s.group_id = $1` → session appears

### Data Flow (Actual — Broken)

1. User is added to a group via `addUserToGroup()`,
   `createAndAddUserToGroup()`, or `approveGroupRequest()`
   → only `group_memberships` row is created/updated
   → `users.active_group_id` and `users.group_id` remain **NULL**
2. User starts a chat session → `getGroupIdForUserId()` reads
   `COALESCE(NULL, NULL)` → returns **NULL**
3. Session is persisted with `sessions.group_id = NULL`
4. Group admin queries sessions → `WHERE s.group_id = $1`
   → session with NULL group_id is **excluded** → invisible

### Affected Code Paths

| Function | File | Issue |
|----------|------|-------|
| `addUserToGroup()` | `chat-backend/src/services/group.service.ts:294` | Inserts `group_memberships` only; does not update `users.active_group_id` |
| `createAndAddUserToGroup()` | `chat-backend/src/services/group.service.ts:343` | Creates user + membership; does not set `users.active_group_id` |
| `approveGroupRequest()` | `chat-backend/src/services/groupMembership.service.ts:263` | Activates membership; does not set `users.active_group_id` |

### Correct Reference Pattern

`setGroupMembershipRole()` at `groupMembership.service.ts:339` already
implements the correct pattern:

```sql
UPDATE users SET active_group_id = COALESCE(active_group_id, $1) WHERE id = $2
```

This sets `active_group_id` only if it is currently NULL, preserving
existing group context. The three broken functions above must adopt this
same pattern.

### Secondary Issue: Query Brittleness

`listGroupSessions()` in `groupSessions.service.ts:30` relies exclusively
on `sessions.group_id` for filtering:

```sql
WHERE s.group_id = $1
```

This means sessions created before the user was added to a group (or
before the fix) will never appear, even after the user becomes a group
member. The `group_memberships` table — the authoritative source for
group membership — is never consulted.

### Historical Context

Migration `010_groups_and_group_scoping.sql` added `group_id` to both
`users` and `sessions`, and included a backfill:

```sql
UPDATE sessions s SET group_id = u.group_id
FROM users u
WHERE s.group_id IS NULL AND s.user_id IS NOT NULL
  AND u.id = s.user_id AND u.group_id IS NOT NULL;
```

This backfill only worked for users who had `users.group_id` set at
migration time. Users added to groups via `addUserToGroup()` after the
migration have `users.group_id = NULL`, so their sessions were never
backfilled.

## Decision: Fix Strategy

### Decision: Two-layer fix (mutation + query)

**Rationale**: Fixing only the mutation points leaves historical sessions
invisible. Fixing only the query without fixing mutations means
`sessions.group_id` remains unreliable for other potential consumers.
Both layers must be fixed.

**Alternatives considered**:

1. *Mutation-only fix + migration backfill*: Would fix future sessions and
   backfill historical ones, but requires ongoing migration maintenance if
   new group assignment flows are added. Chosen as the primary approach.

2. *Query-only fix (JOIN group_memberships)*: More resilient to future
   bugs but changes semantics — a user removed from a group would
   immediately lose all session visibility, even for sessions created
   while they were a member. Also more expensive per query. Rejected as
   primary approach but adopted as defense-in-depth fallback.

3. *Combined approach*: Fix mutations, add backfill migration, AND
   enhance the query to use `group_memberships` as a fallback for
   sessions with NULL `group_id`. **Selected** — provides immediate fix,
   historical data repair, and future resilience.

### Decision: Use `active_group_id` (not `group_id`)

**Rationale**: The `group_id` column on `users` is a legacy direct
assignment field. The `active_group_id` field represents the user's
current group context and is the first operand in
`COALESCE(active_group_id, group_id)`. Setting `active_group_id` is
consistent with `setGroupMembershipRole()` and the multi-group
membership model.

## Impact Assessment

- **Severity**: High — group admin core functionality is broken
- **Affected users**: All users added to groups via the workbench
  interface (manual add, create-and-add, invite approval)
- **Data impact**: No data loss — sessions exist but are not linked to
  groups; fix is non-destructive
- **Rollback risk**: Low — changes are additive (setting previously NULL
  fields, adding fallback query logic)
