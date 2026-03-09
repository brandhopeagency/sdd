-- 020_extend_session_reviews_supervision.sql
-- Adds supervision_status and supervision_required to session_reviews.
BEGIN;

ALTER TABLE session_reviews
    ADD COLUMN IF NOT EXISTS supervision_status VARCHAR(30)
        CHECK (supervision_status IS NULL OR supervision_status IN (
            'pending_supervision', 'approved', 'disapproved', 'revision_requested', 'not_required'
        ));

ALTER TABLE session_reviews
    ADD COLUMN IF NOT EXISTS supervision_required BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_session_reviews_supervision_status
    ON session_reviews(supervision_status)
    WHERE supervision_status = 'pending_supervision';

COMMIT;
