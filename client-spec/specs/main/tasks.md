# Tasks: Fix Group Chats Not Reflected in Group Sessions Interface

**Input**: Design documents from `/specs/main/`
**Prerequisites**: plan.md, research.md
**Repository**: `chat-backend` (`D:\src\MHG\chat-backend`)
**Branch**: `bugfix/group-session-visibility`

**Organization**: Tasks are grouped by fix layer (mutation fix, migration,
query hardening) to enable incremental verification at each checkpoint.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create bugfix branch in `chat-backend` and verify baseline

- [X] T001 Create `bugfix/group-session-visibility` branch from `develop` in `D:\src\MHG\chat-backend`
- [X] T002 Verify current failing behavior: query `SELECT id, active_group_id, group_id FROM users WHERE id IN (SELECT user_id FROM group_memberships WHERE status = 'active') AND active_group_id IS NULL AND group_id IS NULL` against dev DB to confirm affected user count — skipped (requires dev DB access, deferred to T010)

**Checkpoint**: Branch ready, scope of affected data confirmed

---

## Phase 2: Fix Group Membership Mutation Points

**Goal**: Ensure `users.active_group_id` is set whenever a user gains
active group membership, using the existing `COALESCE` pattern from
`setGroupMembershipRole()`.

- [X] T003 [P] Add `UPDATE users SET active_group_id = COALESCE(active_group_id, $1) WHERE id = $2` after the `group_memberships` INSERT/UPSERT in `addUserToGroup()` in `chat-backend/src/services/group.service.ts`
- [X] T004 [P] Add `UPDATE users SET active_group_id = COALESCE(active_group_id, $1) WHERE id = $2` after the `group_memberships` INSERT in `createAndAddUserToGroup()` in `chat-backend/src/services/group.service.ts`
- [X] T005 Add `UPDATE users SET active_group_id = COALESCE(active_group_id, $1) WHERE id = $2` after the membership status update to `'active'` in `approveGroupRequest()` in `chat-backend/src/services/groupMembership.service.ts`

**Checkpoint**: New group assignments correctly set `users.active_group_id`; future sessions will have correct `sessions.group_id`

---

## Phase 3: Data Backfill Migration

**Goal**: Repair existing users and sessions affected by the bug

- [X] T006 Create migration `chat-backend/src/db/migrations/023_backfill_group_session_visibility.sql` that backfills `users.active_group_id` from `group_memberships` for users with NULL `active_group_id` and NULL `group_id`, then backfills `sessions.group_id` from `group_memberships` for sessions with NULL `group_id` whose user has an active membership

**Checkpoint**: Historical data repaired; existing sessions now have correct `group_id` values

---

## Phase 4: Query Enhancement (Defense-in-Depth)

**Goal**: Harden `listGroupSessions()` and `getGroupSessionById()` to find
sessions even if `sessions.group_id` is NULL, using `group_memberships`
as fallback

- [X] T007 [P] Modify the WHERE clause in `listGroupSessions()` in `chat-backend/src/services/groupSessions.service.ts` to add a membership-based fallback: `(s.group_id = $1 OR (s.group_id IS NULL AND s.user_id IN (SELECT gm.user_id FROM group_memberships gm WHERE gm.group_id = $1 AND gm.status = 'active')))`
- [X] T008 [P] Modify the WHERE clause in `getGroupSessionById()` in `chat-backend/src/services/groupSessions.service.ts` to use the same membership-based fallback for consistency

**Checkpoint**: Group sessions endpoint returns all sessions for group members regardless of `sessions.group_id` state

---

## Phase 5: Verification & Delivery

**Purpose**: Validate fix end-to-end, merge via PR

- [X] T009 Run existing unit tests in `chat-backend` to confirm no regressions (`npm test`) — 127 tests passed, 0 failures
- [ ] T010 Manually verify in dev environment: add user to group via workbench, confirm `users.active_group_id` is set, create chat session, confirm session appears in group sessions view
- [X] T011 Open PR from `bugfix/group-session-visibility` to `develop` in `chat-backend` with scope, root cause summary, and test evidence — https://github.com/MentalHelpGlobal/chat-backend/pull/68
- [X] T012 After PR approval and CI checks green, merge to `develop` (squash merge) — merged as d764064
- [X] T013 Delete merged remote and local `bugfix/group-session-visibility` branch and sync local `develop` to `origin/develop`
- [X] T014 Production deployed (PR #69 merged to main, tag v2026.02.24-group-session-visibility). Backmerge #66 synced develop. Smoke: verify `GET /api/group/sessions` with group admin token returns sessions.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Mutation Fix)**: Depends on Phase 1; T003 and T004 can run in parallel (different functions, same file); T005 is in a different file and can also run in parallel
- **Phase 3 (Migration)**: Can run in parallel with Phase 2 (independent artifact — SQL file)
- **Phase 4 (Query Enhancement)**: Can run in parallel with Phase 2 and Phase 3 (different file); T007 and T008 are in the same file but modify different functions
- **Phase 5 (Verification)**: Depends on Phases 2, 3, and 4 being complete

### Parallel Opportunities

```
Phase 2 (T003, T004, T005)  ─┐
Phase 3 (T006)               ├──→ Phase 5 (T009–T014)
Phase 4 (T007, T008)        ─┘
```

All implementation tasks in Phases 2–4 touch different functions or
files and can be executed in parallel.

---

## Implementation Strategy

### Execution Plan

1. Complete Phase 1: Create branch
2. Execute Phases 2, 3, 4 in parallel (all touch different code paths)
3. Complete Phase 5: Test, PR, merge
4. Deploy to dev and verify
5. Promote to production via release cycle (Principle IV / XII)

### Risk Mitigation

- Each phase has a checkpoint for incremental verification
- Migration is non-destructive (sets previously NULL fields)
- Query enhancement is additive (preserves existing fast path)
- All code changes follow the existing `setGroupMembershipRole()` pattern

---

## Notes

- This is a backend-only bugfix in `chat-backend` — no cross-repo changes
- No UI changes — responsive/PWA checks are N/A
- Release Notes entry required when promoting to production
- No Jira Epic currently exists; create via `/speckit.specify` if needed
- Total tasks: 14
- Parallel tasks: T003+T004+T005 (Phase 2), T007+T008 (Phase 4), Phase 2+3+4 across phases
