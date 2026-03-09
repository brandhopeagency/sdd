-- Migration 027: Add requires_approval to group_invite_codes
-- Fixes 026 partial migration where invitation_codes was the wrong table name
ALTER TABLE group_invite_codes
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT true;
