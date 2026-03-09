-- =============================================================================
-- E2E Test Account Seed Script
-- =============================================================================
-- Creates pre-seeded test accounts for Playwright E2E tests.
-- All inserts are idempotent (ON CONFLICT DO NOTHING) — safe to re-run.
--
-- Usage:
--   gcloud sql connect chat-db-dev --user=chat_user --database=chat_app \
--     --project=mental-help-global-25
--   \i seed-e2e-accounts.sql
--
-- See: specs/007-e2e-coverage/data-model.md
-- =============================================================================

BEGIN;

-- 1. Create test user accounts (one per role)
INSERT INTO users (email, display_name, role, status)
VALUES
  ('e2e-user@test.local',        'E2E User',            'user',          'active'),
  ('e2e-qa@test.local',          'E2E QA Specialist',   'qa_specialist', 'active'),
  ('e2e-researcher@test.local',  'E2E Researcher',      'researcher',    'active'),
  ('e2e-moderator@test.local',   'E2E Moderator',       'moderator',     'active'),
  ('e2e-group-admin@test.local', 'E2E Group Admin',     'group_admin',   'active'),
  ('e2e-owner@test.local',       'E2E Owner',           'owner',         'active')
ON CONFLICT (email) DO NOTHING;

-- 2. Create test group
INSERT INTO groups (name)
VALUES ('E2E Test Group')
ON CONFLICT (name) DO NOTHING;

-- 3. Link owner as group admin
INSERT INTO group_memberships (user_id, group_id, role, status)
SELECT u.id, g.id, 'admin', 'active'
FROM users u, groups g
WHERE u.email = 'e2e-owner@test.local'
  AND g.name = 'E2E Test Group'
ON CONFLICT (group_id, user_id) DO NOTHING;

-- 4. Link group_admin as group admin
INSERT INTO group_memberships (user_id, group_id, role, status)
SELECT u.id, g.id, 'admin', 'active'
FROM users u, groups g
WHERE u.email = 'e2e-group-admin@test.local'
  AND g.name = 'E2E Test Group'
ON CONFLICT (group_id, user_id) DO NOTHING;

-- 5. Link moderator as group member
INSERT INTO group_memberships (user_id, group_id, role, status)
SELECT u.id, g.id, 'member', 'active'
FROM users u, groups g
WHERE u.email = 'e2e-moderator@test.local'
  AND g.name = 'E2E Test Group'
ON CONFLICT (group_id, user_id) DO NOTHING;

-- 6. Set active_group_id for users who need group-scoped workbench views
UPDATE users
SET active_group_id = (SELECT id FROM groups WHERE name = 'E2E Test Group')
WHERE email IN ('e2e-owner@test.local', 'e2e-group-admin@test.local')
  AND active_group_id IS NULL;

COMMIT;

-- Verify
SELECT email, role, status FROM users WHERE email LIKE 'e2e-%@test.local' ORDER BY role;
