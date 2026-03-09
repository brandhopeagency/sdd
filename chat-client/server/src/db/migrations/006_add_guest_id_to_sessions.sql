-- ============================================
-- Add guest_id to sessions
-- ============================================
-- We use guest_id to track guest (non-UUID) identities without violating
-- the sessions.user_id UUID foreign key constraint.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS guest_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_guest_id ON sessions(guest_id);

COMMENT ON COLUMN sessions.guest_id IS 'Ephemeral guest identifier (starts with guest_). Null for authenticated sessions.';

