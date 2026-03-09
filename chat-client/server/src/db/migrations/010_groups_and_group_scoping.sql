-- ============================================
-- Groups + group scoping (users, sessions)
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Groups table
-- ============================================
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);

-- Keep updated_at consistent
DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE groups IS 'User groups for scoped administration and analytics';
COMMENT ON COLUMN groups.name IS 'Human-readable group name';

-- ============================================
-- Users: add group_id + extend role enum constraint
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);

-- Base schema defines a named constraint "valid_role"; extend it to include group_admin
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE users
  ADD CONSTRAINT valid_role CHECK (role IN ('user', 'qa_specialist', 'researcher', 'moderator', 'owner', 'group_admin'));

COMMENT ON COLUMN users.group_id IS 'Optional group assignment for scoped administration';

-- ============================================
-- Sessions: add group_id (copied from user on session creation)
-- ============================================
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_group_id ON sessions(group_id);

-- Best-effort backfill for existing sessions (only authenticated sessions)
UPDATE sessions s
SET group_id = u.group_id
FROM users u
WHERE s.group_id IS NULL
  AND s.user_id IS NOT NULL
  AND u.id = s.user_id
  AND u.group_id IS NOT NULL;

COMMENT ON COLUMN sessions.group_id IS 'Group snapshot for this session (copied from users.group_id)';

