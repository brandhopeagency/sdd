# Implementation Plan: Fix Group Chats Not Reflected in Group Sessions Interface

**Branch**: `bugfix/group-session-visibility` | **Date**: 2026-02-24 | **Spec**: Production bugfix (user report)
**Input**: Group admin reports that chats from users within the group are not visible in the group sessions interface.

## Summary

Users added to groups via `addUserToGroup()`, `createAndAddUserToGroup()`,
or `approveGroupRequest()` have their `users.active_group_id` left as NULL.
When those users create chat sessions, `getGroupIdForUserId()` returns NULL,
and `sessions.group_id` is stored as NULL. The group sessions query filters
by `sessions.group_id = $groupId`, so NULL-group sessions are invisible.

The fix applies the existing `COALESCE(active_group_id, $groupId)` pattern
(already used in `setGroupMembershipRole()`) to all three broken mutation
points, adds a data backfill migration, and enhances the group sessions
query with a membership-based fallback.

## Technical Context

**Language/Version**: TypeScript / Node.js (Express.js backend)
**Primary Dependencies**: Express.js, `pg` (PostgreSQL driver)
**Storage**: PostgreSQL (Cloud SQL)
**Testing**: Vitest (unit tests in `chat-backend`)
**Target Platform**: GCP Cloud Run (Linux)
**Project Type**: Web application (split repositories)
**Constraints**: Production hotfix — minimal change surface, backward-compatible

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Spec-first workflow is preserved (bugfix documented → plan → tasks → implementation)
- [x] Affected split repositories are explicitly listed with per-repo file paths
- [x] Test strategy aligns with each target repository conventions (Vitest for chat-backend)
- [x] Integration strategy enforces PR-only merges into `develop` from bugfix branch
- [x] Required approvals and required CI checks are identified (chat-backend CI)
- [x] Post-merge hygiene is defined: delete merged remote/local bugfix branch
      and sync local `develop` to `origin/develop`
- [x] For user-facing changes, responsive and PWA compatibility checks are
      defined — N/A (backend-only fix, no UI changes)
- [x] Post-deploy smoke checks are defined: verify group sessions endpoint
      returns sessions for users with active group memberships
- [ ] Jira Epic exists for this feature — PENDING (bugfix, to be created)
- [x] Documentation impact identified: Release Notes require entry on fix;
      User Manual and Technical Onboarding do not need updates (no UI or
      workflow changes)
- [x] Release readiness verified: `chat-backend` has deploy workflows for
      both dev and prod environments

## Project Structure

### Documentation (this bugfix)

```text
specs/main/
├── plan.md              # This file
├── research.md          # Root cause analysis
└── tasks.md             # Task breakdown (via /speckit.tasks)
```

### Source Code (affected repositories)

```text
chat-backend/
├── src/
│   ├── services/
│   │   ├── group.service.ts          # addUserToGroup, createAndAddUserToGroup
│   │   ├── groupMembership.service.ts # approveGroupRequest
│   │   ├── groupSessions.service.ts   # listGroupSessions query
│   │   └── session.service.ts         # getGroupIdForUserId (reference)
│   └── db/
│       └── migrations/
│           └── 023_backfill_group_session_visibility.sql  # New migration
└── tests/
    └── unit/
        └── group-session-visibility.test.ts  # New test file
```

**Structure Decision**: Single-repository bugfix in `chat-backend`. No
cross-repo changes needed — the bug is entirely in the backend service
layer and database.

## Fix Implementation

### Layer 1: Fix Group Mutation Points

**Goal**: Ensure `users.active_group_id` is set whenever a user gains
active group membership.

#### 1a. `addUserToGroup()` — `group.service.ts:294`

After the `group_memberships` INSERT/UPSERT (line 308–325), add:

```sql
UPDATE users SET active_group_id = COALESCE(active_group_id, $1) WHERE id = $2
```

This matches the pattern already used in `setGroupMembershipRole()` at
`groupMembership.service.ts:361`.

#### 1b. `createAndAddUserToGroup()` — `group.service.ts:343`

After the `group_memberships` INSERT (line 368–381), add the same
`UPDATE users SET active_group_id = COALESCE(active_group_id, $1)` query.
Since the user was just created, `active_group_id` is guaranteed NULL, so
this always sets it.

#### 1c. `approveGroupRequest()` — `groupMembership.service.ts:263`

After the membership status is set to `'active'` (line 301–308), add:

```sql
UPDATE users SET active_group_id = COALESCE(active_group_id, $1) WHERE id = $2
```

This ensures that users approved via the invite flow get their
`active_group_id` set on approval, not deferred until they manually
select a group.

### Layer 2: Data Backfill Migration

**Goal**: Repair existing sessions and users affected by the bug.

Create migration `023_backfill_group_session_visibility.sql`:

```sql
-- Step 1: Set active_group_id for users who have active memberships
-- but NULL active_group_id and NULL group_id
UPDATE users u
SET active_group_id = (
  SELECT gm.group_id
  FROM group_memberships gm
  WHERE gm.user_id = u.id AND gm.status = 'active'
  ORDER BY gm.approved_at ASC NULLS LAST
  LIMIT 1
)
WHERE u.active_group_id IS NULL
  AND u.group_id IS NULL
  AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.user_id = u.id AND gm.status = 'active'
  );

-- Step 2: Backfill sessions.group_id using group_memberships
-- for sessions where group_id is NULL but user has active membership
UPDATE sessions s
SET group_id = (
  SELECT gm.group_id
  FROM group_memberships gm
  WHERE gm.user_id = s.user_id AND gm.status = 'active'
  ORDER BY gm.approved_at ASC NULLS LAST
  LIMIT 1
)
WHERE s.group_id IS NULL
  AND s.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.user_id = s.user_id AND gm.status = 'active'
  );
```

### Layer 3: Query Enhancement (Defense-in-Depth)

**Goal**: Ensure `listGroupSessions()` can find sessions even if
`sessions.group_id` was not properly set.

Modify `listGroupSessions()` in `groupSessions.service.ts` to use a
combined filter:

```sql
WHERE (s.group_id = $1
       OR (s.group_id IS NULL
           AND s.user_id IN (
             SELECT gm.user_id
             FROM group_memberships gm
             WHERE gm.group_id = $1 AND gm.status = 'active'
           )))
```

This preserves the existing fast path (`s.group_id = $1`) and adds a
fallback for sessions with NULL `group_id` belonging to current group
members. After the migration backfills data, the fallback clause will
match zero rows in steady state.

Similarly update `getGroupSessionById()` to use the same combined filter
for consistency.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration backfill sets wrong group for multi-group users | Low | Low | Uses earliest approved membership; `active_group_id` uses COALESCE (preserves existing) |
| Query fallback introduces performance regression | Low | Low | Subquery only executes when `s.group_id IS NULL`; post-migration this matches ~0 rows |
| Mutation fix causes unexpected side effects | Very Low | Low | Uses exact same pattern as existing `setGroupMembershipRole()` |

## Rollback Plan

1. **Code rollback**: Revert the three service file changes — sessions
   will resume being created with NULL `group_id` (pre-existing behavior)
2. **Migration**: The backfill migration is non-destructive (sets
   previously NULL fields). No rollback migration needed — the data
   corrections are valid regardless of code state.
3. **Query rollback**: Revert `listGroupSessions()` changes — the
   backfilled `sessions.group_id` values will keep sessions visible.

## Verification

### Pre-deploy (dev environment)

1. Add a user to a group via workbench
2. Verify `users.active_group_id` is set (query DB directly)
3. User creates a chat session
4. Verify `sessions.group_id` matches the group UUID
5. Group admin views group sessions → new session is visible

### Post-deploy (production)

1. Run migration — verify it completes without errors
2. Group admin views group sessions → previously invisible sessions
   now appear
3. Add a new user to group → their subsequent sessions are visible
4. Verify health endpoint returns ok

## Complexity Tracking

No constitution violations. All changes follow existing patterns in the
codebase.
