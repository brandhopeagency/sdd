-- Migration 026: Survey Module Enhancements
-- Feature: 019-survey-question-enhancements
-- Rollback: DROP TABLE group_survey_order; ALTER TABLE survey_instances DROP COLUMN public_header, DROP COLUMN show_review, ADD COLUMN priority INTEGER NOT NULL DEFAULT 0; ALTER TABLE group_invite_codes DROP COLUMN requires_approval;

-- 1) New table: per-group survey ordering (replaces priority field)
CREATE TABLE IF NOT EXISTS group_survey_order (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL,
  instance_id    UUID NOT NULL REFERENCES survey_instances(id) ON DELETE CASCADE,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, instance_id)
);
CREATE INDEX IF NOT EXISTS idx_group_survey_order_group ON group_survey_order(group_id);

-- 2) Seed group_survey_order from existing instances using priority+start_date ordering.
-- Each instance may target multiple groups (group_ids array); create one row per group.
INSERT INTO group_survey_order (group_id, instance_id, display_order)
SELECT
  g AS group_id,
  si.id AS instance_id,
  ROW_NUMBER() OVER (PARTITION BY g ORDER BY si.start_date ASC)::INTEGER AS display_order
FROM survey_instances si,
     LATERAL unnest(si.group_ids) AS g
ON CONFLICT (group_id, instance_id) DO NOTHING;

-- 3) Instance enhancements: custom header + optional review step
ALTER TABLE survey_instances
  ADD COLUMN IF NOT EXISTS public_header VARCHAR(300),
  ADD COLUMN IF NOT EXISTS show_review BOOLEAN NOT NULL DEFAULT true;

-- 4) Remove priority field (replaced by group_survey_order)
ALTER TABLE survey_instances
  DROP COLUMN IF EXISTS priority;

-- 5) Invitation code: per-code approval control
ALTER TABLE group_invite_codes
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT true;
