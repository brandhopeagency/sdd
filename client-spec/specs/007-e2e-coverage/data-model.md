# Data Model: E2E Test Coverage Expansion

**Feature**: 007-e2e-coverage | **Date**: 2026-02-08

This feature does not introduce new database tables or modify existing schema. Instead, it defines **test seed data** — pre-seeded rows in existing tables that E2E tests depend on.

## Test User Accounts

Six fixed test accounts, one per role. All accounts have `status = 'active'` and use the `@test.local` domain (non-routable, safe for testing).

| Email | Display Name | Role | Status | Purpose |
|-------|-------------|------|--------|---------|
| `e2e-user@test.local` | E2E User | `user` | `active` | Basic chat tests, guest upgrade target |
| `e2e-qa@test.local` | E2E QA Specialist | `qa_specialist` | `active` | Technical details toggle test |
| `e2e-researcher@test.local` | E2E Researcher | `researcher` | `active` | Research list access test |
| `e2e-moderator@test.local` | E2E Moderator | `moderator` | `active` | Moderation view, user management tests |
| `e2e-group-admin@test.local` | E2E Group Admin | `group_admin` | `active` | Group dashboard, member management tests |
| `e2e-owner@test.local` | E2E Owner | `owner` | `active` | Full-access tests: privacy, review, groups |

### SQL Definition

```sql
INSERT INTO users (email, display_name, role, status)
VALUES
  ('e2e-user@test.local',        'E2E User',            'user',          'active'),
  ('e2e-qa@test.local',          'E2E QA Specialist',   'qa_specialist', 'active'),
  ('e2e-researcher@test.local',  'E2E Researcher',      'researcher',    'active'),
  ('e2e-moderator@test.local',   'E2E Moderator',       'moderator',     'active'),
  ('e2e-group-admin@test.local', 'E2E Group Admin',     'group_admin',   'active'),
  ('e2e-owner@test.local',       'E2E Owner',           'owner',         'active')
ON CONFLICT (email) DO NOTHING;
```

## Test Group

One test group for group management and group-scoped workbench tests.

| Field | Value |
|-------|-------|
| Name | `E2E Test Group` |
| Archived | `NULL` (active) |

### SQL Definition

```sql
INSERT INTO groups (name)
VALUES ('E2E Test Group')
ON CONFLICT (name) DO NOTHING;
```

## Group Memberships

Connect the owner and group admin accounts to the test group.

| User | Group | Role | Status |
|------|-------|------|--------|
| `e2e-owner@test.local` | `E2E Test Group` | `admin` | `active` |
| `e2e-group-admin@test.local` | `E2E Test Group` | `admin` | `active` |
| `e2e-moderator@test.local` | `E2E Test Group` | `member` | `active` |

### SQL Definition

```sql
-- Link owner as group admin
INSERT INTO group_memberships (user_id, group_id, role, status)
SELECT u.id, g.id, 'admin', 'active'
FROM users u, groups g
WHERE u.email = 'e2e-owner@test.local'
  AND g.name = 'E2E Test Group'
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Link group_admin as group admin
INSERT INTO group_memberships (user_id, group_id, role, status)
SELECT u.id, g.id, 'admin', 'active'
FROM users u, groups g
WHERE u.email = 'e2e-group-admin@test.local'
  AND g.name = 'E2E Test Group'
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Link moderator as group member
INSERT INTO group_memberships (user_id, group_id, role, status)
SELECT u.id, g.id, 'member', 'active'
FROM users u, groups g
WHERE u.email = 'e2e-moderator@test.local'
  AND g.name = 'E2E Test Group'
ON CONFLICT (group_id, user_id) DO NOTHING;
```

## Active Group Assignment

Set `active_group_id` for users who should see group-scoped workbench views.

```sql
UPDATE users
SET active_group_id = (SELECT id FROM groups WHERE name = 'E2E Test Group')
WHERE email IN ('e2e-owner@test.local', 'e2e-group-admin@test.local')
  AND active_group_id IS NULL;
```

## Role → Permission Matrix (Reference)

Permissions are computed at runtime from the `ROLE_PERMISSIONS` mapping in `@mentalhelpglobal/chat-types`. This matrix shows what each test account can access:

| Permission | user | qa | researcher | moderator | group_admin | owner |
|-----------|------|-----|-----------|-----------|-------------|-------|
| `chat_access` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `chat_send` | ✅ | ✅ | | | | ✅ |
| `chat_feedback` | ✅ | ✅ | | | | ✅ |
| `chat_debug` | | ✅ | | | | ✅ |
| `workbench_access` | | | ✅ | ✅ | ✅ | ✅ |
| `workbench_user_management` | | | | ✅ | | ✅ |
| `workbench_research` | | | ✅ | ✅ | | ✅ |
| `workbench_moderation` | | | | ✅ | | ✅ |
| `workbench_privacy` | | | | | | ✅ |
| `workbench_group_dashboard` | | | | | ✅ | ✅ |
| `workbench_group_users` | | | | | ✅ | ✅ |
| `workbench_group_research` | | | | | ✅ | ✅ |
| `data_view_pii` | | | | | | ✅ |
| `data_export` | | | | | | ✅ |
| `data_delete` | | | | | | ✅ |

## Test Account → Test Area Mapping

| Test Area | Primary Account | Why |
|-----------|----------------|-----|
| Authentication (login/logout) | `e2e-user` | Basic user exercises standard auth flow |
| Chat (send/receive/feedback) | `e2e-user` | Standard user has `chat_send`, `chat_feedback` |
| Chat (technical details) | `e2e-qa` | QA specialist has `chat_debug` permission |
| Guest chat | *(no account)* | Guest tests start unauthenticated |
| Workbench (navigation, shell) | `e2e-moderator` | Moderator has `workbench_access` + multiple sections |
| Workbench (users) | `e2e-moderator` | Moderator has `workbench_user_management` |
| Research & Moderation | `e2e-moderator` | Moderator has `workbench_research` + `workbench_moderation` |
| Group admin dashboard | `e2e-group-admin` | Group admin has `workbench_group_*` permissions |
| Group lifecycle (create/invite) | `e2e-owner` | Owner has all permissions including group creation |
| Privacy & GDPR | `e2e-owner` | Owner has `workbench_privacy`, `data_*` permissions |
| Review system | `e2e-owner` | Owner has access to all features including review |

## Notes on Test Data Dependencies

- **Membership approval test (T015)**: The approval workflow requires a pending membership request, which cannot be created via SQL seed alone — it requires a user to log in with an invite code. T015 handles this by generating an invite code in the test, then using it to create a pending request.
- **Privacy tests (T019–T020)**: PII masking toggle is implemented and testable. Data export, erasure, and audit log show "Coming soon" — tests assert the placeholder state (not skip). When those features ship, tests will be updated to verify real functionality.
- **Review tests (T021–T022)**: Depend on existing chat sessions in the dev database. If the queue is empty, tests skip gracefully.

## Seed Script Requirements

1. **Idempotent**: All inserts use `ON CONFLICT DO NOTHING`; updates use `WHERE ... IS NULL` guards
2. **No foreign key ordering issues**: Groups created before memberships; users created before memberships
3. **No sensitive data**: `@test.local` domain is non-routable; no real user data
4. **Execution**: Run once against the dev database via `psql` or Cloud SQL Proxy
5. **Location**: `chat-backend/src/db/seeds/seed-e2e-accounts.sql` + `chat-client/server/src/db/seeds/seed-e2e-accounts.sql`
