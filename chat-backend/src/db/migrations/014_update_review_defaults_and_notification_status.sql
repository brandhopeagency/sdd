-- ============================================
-- 014: Update review defaults and add notification
-- delivery status tracking (FR-026)
-- ============================================

BEGIN;

-- Update deanonymization access hours default to 72 (spec clarification)
ALTER TABLE review_configuration
    ALTER COLUMN deanonymization_access_hours SET DEFAULT 72;

UPDATE review_configuration
    SET deanonymization_access_hours = 72
    WHERE id = 1 AND deanonymization_access_hours = 24;

-- Add notification delivery status to risk_flags (FR-026)
-- Tracks whether high-risk flag notifications were successfully delivered
ALTER TABLE risk_flags
    ADD COLUMN IF NOT EXISTS notification_delivery_status VARCHAR(10)
    DEFAULT 'pending'
    CHECK (notification_delivery_status IN ('delivered', 'pending', 'failed'));

COMMIT;
