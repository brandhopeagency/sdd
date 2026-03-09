-- 019_extend_review_config_supervision.sql
-- Adds supervision_policy and supervision_sample_percentage to review_configuration.
BEGIN;

ALTER TABLE review_configuration
    ADD COLUMN IF NOT EXISTS supervision_policy VARCHAR(20) NOT NULL DEFAULT 'none'
        CHECK (supervision_policy IN ('all', 'sampled', 'none'));

ALTER TABLE review_configuration
    ADD COLUMN IF NOT EXISTS supervision_sample_percentage INT NOT NULL DEFAULT 100
        CHECK (supervision_sample_percentage >= 1 AND supervision_sample_percentage <= 100);

COMMIT;
