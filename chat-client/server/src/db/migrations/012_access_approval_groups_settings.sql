-- ============================================
-- Access approval, multi-group memberships, settings
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Users: approval/disapproval fields + status enum extension
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS disapproved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS disapproval_comment TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS disapproval_count INTEGER NOT NULL DEFAULT 0;

-- Extend status constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE users
  ADD CONSTRAINT valid_status CHECK (status IN ('active', 'blocked', 'pending', 'approval', 'disapproved', 'anonymized'));

-- ============================================
-- Global settings (single row)
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    guest_mode_enabled BOOLEAN NOT NULL DEFAULT false,
    approval_cooloff_days INTEGER NOT NULL DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_singleton ON settings(id);

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

INSERT INTO settings (id, guest_mode_enabled, approval_cooloff_days)
VALUES (1, false, 7)
ON CONFLICT (id) DO NOTHING;

