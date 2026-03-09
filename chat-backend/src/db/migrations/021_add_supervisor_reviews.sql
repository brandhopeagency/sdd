-- 021_add_supervisor_reviews.sql
-- Creates supervisor_reviews table for second-level review decisions.
BEGIN;

CREATE TABLE IF NOT EXISTS supervisor_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_review_id UUID NOT NULL REFERENCES session_reviews(id) ON DELETE CASCADE,
    supervisor_id UUID NOT NULL REFERENCES users(id),
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'disapproved')),
    comments TEXT NOT NULL CHECK (LENGTH(comments) >= 1),
    return_to_reviewer BOOLEAN NOT NULL DEFAULT false,
    revision_iteration INT NOT NULL DEFAULT 1 CHECK (revision_iteration >= 1 AND revision_iteration <= 3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_supervisor_review_iteration UNIQUE (session_review_id, revision_iteration)
);

CREATE INDEX IF NOT EXISTS idx_supervisor_reviews_session_review_id
    ON supervisor_reviews(session_review_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_reviews_supervisor_id
    ON supervisor_reviews(supervisor_id);

COMMIT;
