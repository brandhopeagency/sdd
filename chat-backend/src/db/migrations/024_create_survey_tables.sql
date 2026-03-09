-- Migration 024: Create Survey Module tables
-- Feature: MHG-SURV-001 (Workbench Survey Module)
-- Rollback: DROP TABLE survey_responses; DROP TABLE survey_instances; DROP TABLE survey_schemas;

-- SurveySchema
CREATE TABLE survey_schemas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(200)  NOT NULL,
  description     TEXT,
  status          VARCHAR(20)   NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
  questions       JSONB         NOT NULL DEFAULT '[]',
  cloned_from_id  UUID          REFERENCES survey_schemas(id) ON DELETE SET NULL,
  created_by      UUID          NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- SurveyInstance
CREATE TABLE survey_instances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id        UUID          NOT NULL REFERENCES survey_schemas(id),
  schema_snapshot  JSONB         NOT NULL,
  title            VARCHAR(200)  NOT NULL,
  status           VARCHAR(20)   NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','active','expired','closed')),
  priority         INTEGER       NOT NULL DEFAULT 0,
  group_ids        UUID[]        NOT NULL,
  start_date       TIMESTAMPTZ   NOT NULL,
  expiration_date  TIMESTAMPTZ   NOT NULL,
  created_by       UUID          NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT expiry_after_start CHECK (expiration_date > start_date)
);

-- SurveyResponse
CREATE TABLE survey_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id      UUID          NOT NULL REFERENCES survey_instances(id),
  pseudonymous_id  UUID          NOT NULL,
  answers          JSONB         NOT NULL DEFAULT '[]',
  started_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  is_complete      BOOLEAN       NOT NULL DEFAULT false,
  UNIQUE (instance_id, pseudonymous_id)
);

-- Indexes
CREATE INDEX idx_survey_instances_status     ON survey_instances(status);
CREATE INDEX idx_survey_instances_group_ids  ON survey_instances USING GIN(group_ids);
CREATE INDEX idx_survey_responses_instance   ON survey_responses(instance_id);
CREATE INDEX idx_survey_responses_pseudo     ON survey_responses(pseudonymous_id);
