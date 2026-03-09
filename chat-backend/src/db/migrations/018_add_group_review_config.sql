-- 018_add_group_review_config.sql
-- Per-group review configuration overrides.
BEGIN;

CREATE TABLE IF NOT EXISTS group_review_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,
    reviewer_count_override INT CHECK (reviewer_count_override IS NULL OR reviewer_count_override >= 1),
    supervision_policy VARCHAR(20) CHECK (supervision_policy IS NULL OR supervision_policy IN ('all', 'sampled', 'none')),
    supervision_sample_percentage INT CHECK (supervision_sample_percentage IS NULL OR (supervision_sample_percentage >= 1 AND supervision_sample_percentage <= 100)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_review_config_group
    ON group_review_config(group_id);

-- Auto-update updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_group_review_config_updated_at'
    ) THEN
        CREATE TRIGGER set_group_review_config_updated_at
            BEFORE UPDATE ON group_review_config
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

COMMIT;
