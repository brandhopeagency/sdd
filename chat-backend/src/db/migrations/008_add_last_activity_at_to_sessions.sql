-- ============================================
-- Add last_activity_at to sessions (for TTL)
-- ============================================
-- We use last_activity_at to track real user activity (messages), so we can:
-- - expire sessions after 24h of inactivity
-- - avoid relying on updated_at (which can change due to admin/moderation updates)

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;

-- Backfill for existing rows (best-effort)
UPDATE sessions
SET last_activity_at = COALESCE(last_activity_at, updated_at, started_at)
WHERE last_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_last_activity_at ON sessions(last_activity_at DESC);

COMMENT ON COLUMN sessions.last_activity_at IS 'Last meaningful activity time (used for session TTL / expiry)';

