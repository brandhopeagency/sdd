-- Migration 025: Extend Survey tables for invalidation + memory + group context
-- Feature: MHG-SURV-001 (Workbench Survey Module)
-- Rollback (manual): DROP INDEXes created here; then ALTER TABLE ... DROP COLUMN ...

-- 1) SurveyInstance: add add_to_memory toggle
ALTER TABLE survey_instances
  ADD COLUMN add_to_memory BOOLEAN NOT NULL DEFAULT false;

-- 2) SurveyResponse: add group context + invalidation markers
ALTER TABLE survey_responses
  ADD COLUMN group_id UUID,
  ADD COLUMN invalidated_at TIMESTAMPTZ,
  ADD COLUMN invalidated_by UUID REFERENCES users(id),
  ADD COLUMN invalidation_reason TEXT;

-- Best-effort backfill for existing rows:
-- If an instance targets exactly one group, we can deterministically set group_id.
UPDATE survey_responses sr
SET group_id = si.group_ids[1]
FROM survey_instances si
WHERE si.id = sr.instance_id
  AND sr.group_id IS NULL
  AND array_length(si.group_ids, 1) = 1;

-- 3) Indexes supporting gate-check + invalidation queries
CREATE INDEX idx_survey_responses_instance_group
  ON survey_responses(instance_id, group_id);

-- Fast "is the gate satisfied?" lookups:
CREATE INDEX idx_survey_responses_valid_gate
  ON survey_responses(instance_id, pseudonymous_id)
  WHERE is_complete = true AND invalidated_at IS NULL;

