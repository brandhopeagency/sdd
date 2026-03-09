-- ============================================
-- Group memberships (multi-group roles) + invites + archiving
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Groups: archiving
-- ============================================
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_groups_archived_at ON groups(archived_at);

COMMENT ON COLUMN groups.archived_at IS 'When the group was archived (null = active)';
COMMENT ON COLUMN groups.archived_by IS 'User who archived the group';

-- ============================================
-- Users: active group selection (for UI context)
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_active_group_id ON users(active_group_id);

COMMENT ON COLUMN users.active_group_id IS 'Selected/active group context for the user (optional)';

-- Best-effort backfill from legacy users.group_id
UPDATE users
SET active_group_id = group_id
WHERE active_group_id IS NULL
  AND group_id IS NOT NULL;

-- ============================================
-- Group memberships (multi-group)
-- ============================================
CREATE TABLE IF NOT EXISTS group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_group_membership_role CHECK (role IN ('member', 'admin')),
  CONSTRAINT valid_group_membership_status CHECK (status IN ('active', 'pending', 'rejected', 'removed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_memberships_group_user ON group_memberships(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user_id ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group_id ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_status ON group_memberships(status);

DROP TRIGGER IF EXISTS update_group_memberships_updated_at ON group_memberships;
CREATE TRIGGER update_group_memberships_updated_at
  BEFORE UPDATE ON group_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE group_memberships IS 'User membership in groups with per-group role and approval status';

-- Backfill memberships from legacy users.group_id (best-effort)
INSERT INTO group_memberships (user_id, group_id, role, status, approved_at, metadata)
SELECT
  u.id,
  u.group_id,
  CASE WHEN u.role = 'group_admin' THEN 'admin' ELSE 'member' END,
  'active',
  NOW(),
  jsonb_build_object('migratedFromUsersTable', true)
FROM users u
WHERE u.group_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM group_memberships gm WHERE gm.user_id = u.id AND gm.group_id = u.group_id
  );

-- ============================================
-- Group invite codes (for requesting access to a specific group)
-- ============================================
CREATE TABLE IF NOT EXISTS group_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  code VARCHAR(64) UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT valid_invite_max_uses CHECK (max_uses >= 1),
  CONSTRAINT valid_invite_uses CHECK (uses >= 0)
);

CREATE INDEX IF NOT EXISTS idx_group_invite_codes_group_id ON group_invite_codes(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invite_codes_code ON group_invite_codes(code);

COMMENT ON TABLE group_invite_codes IS 'Invite codes that allow users to request access to a specific group';

