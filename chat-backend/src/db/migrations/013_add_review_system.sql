-- ============================================
-- Review system: structured peer review, risk
-- flagging, deanonymization, and crisis detection
-- ============================================

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. session_reviews — per-reviewer assessment of a session
-- ============================================
CREATE TABLE IF NOT EXISTS session_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    reviewer_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
    is_tiebreaker BOOLEAN NOT NULL DEFAULT false,
    average_score DECIMAL(3,1),
    overall_comment TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    config_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT session_reviews_session_reviewer_unique UNIQUE (session_id, reviewer_id)
);

-- Indexes for session_reviews
CREATE INDEX IF NOT EXISTS idx_session_reviews_session_status
    ON session_reviews(session_id, status);
CREATE INDEX IF NOT EXISTS idx_session_reviews_reviewer_status
    ON session_reviews(reviewer_id, status);
CREATE INDEX IF NOT EXISTS idx_session_reviews_expires_at_active
    ON session_reviews(expires_at)
    WHERE status IN ('pending', 'in_progress');

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_session_reviews_updated_at ON session_reviews;
CREATE TRIGGER update_session_reviews_updated_at
    BEFORE UPDATE ON session_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE session_reviews IS 'Individual reviewer assessments of chat sessions';

-- ============================================
-- 2. message_ratings — per-message score within a review
-- ============================================
CREATE TABLE IF NOT EXISTS message_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES session_reviews(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES session_messages(id),
    score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT message_ratings_review_message_unique UNIQUE (review_id, message_id)
);

-- Indexes for message_ratings
CREATE INDEX IF NOT EXISTS idx_message_ratings_review_id
    ON message_ratings(review_id);
CREATE INDEX IF NOT EXISTS idx_message_ratings_message_id
    ON message_ratings(message_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_message_ratings_updated_at ON message_ratings;
CREATE TRIGGER update_message_ratings_updated_at
    BEFORE UPDATE ON message_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE message_ratings IS 'Per-message numeric scores given during a session review';

-- ============================================
-- 3. criteria_feedback — structured feedback per criterion
-- ============================================
CREATE TABLE IF NOT EXISTS criteria_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating_id UUID NOT NULL REFERENCES message_ratings(id) ON DELETE CASCADE,
    criterion VARCHAR(20) NOT NULL
        CHECK (criterion IN ('relevance', 'empathy', 'safety', 'ethics', 'clarity')),
    feedback_text TEXT NOT NULL CHECK (LENGTH(feedback_text) >= 10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT criteria_feedback_rating_criterion_unique UNIQUE (rating_id, criterion)
);

-- Indexes for criteria_feedback
CREATE INDEX IF NOT EXISTS idx_criteria_feedback_rating_id
    ON criteria_feedback(rating_id);

COMMENT ON TABLE criteria_feedback IS 'Criterion-level qualitative feedback on individual message ratings';

-- ============================================
-- 4. risk_flags — safety / compliance flags on sessions
-- ============================================
CREATE TABLE IF NOT EXISTS risk_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    flagged_by UUID REFERENCES users(id),
    severity VARCHAR(10) NOT NULL
        CHECK (severity IN ('high', 'medium', 'low')),
    reason_category VARCHAR(30) NOT NULL,
    details TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'acknowledged', 'resolved', 'escalated')),
    assigned_moderator_id UUID REFERENCES users(id),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    deanonymization_requested BOOLEAN NOT NULL DEFAULT false,
    is_auto_detected BOOLEAN NOT NULL DEFAULT false,
    matched_keywords TEXT[],
    sla_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for risk_flags
CREATE INDEX IF NOT EXISTS idx_risk_flags_session_id
    ON risk_flags(session_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_severity_status
    ON risk_flags(severity, status);
CREATE INDEX IF NOT EXISTS idx_risk_flags_moderator_status
    ON risk_flags(assigned_moderator_id, status);
CREATE INDEX IF NOT EXISTS idx_risk_flags_sla_deadline_active
    ON risk_flags(sla_deadline)
    WHERE status IN ('open', 'acknowledged');

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_risk_flags_updated_at ON risk_flags;
CREATE TRIGGER update_risk_flags_updated_at
    BEFORE UPDATE ON risk_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE risk_flags IS 'Safety and compliance flags raised on chat sessions';

-- ============================================
-- 5. deanonymization_requests — controlled identity reveal
-- ============================================
CREATE TABLE IF NOT EXISTS deanonymization_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    target_user_id UUID NOT NULL REFERENCES users(id),
    requester_id UUID NOT NULL REFERENCES users(id),
    approver_id UUID REFERENCES users(id),
    risk_flag_id UUID REFERENCES risk_flags(id),
    justification_category VARCHAR(30) NOT NULL,
    justification_details TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'denied')),
    denial_notes TEXT,
    access_expires_at TIMESTAMPTZ,
    accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for deanonymization_requests
CREATE INDEX IF NOT EXISTS idx_deanonymization_requests_pending
    ON deanonymization_requests(status)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_deanonymization_requests_requester
    ON deanonymization_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_deanonymization_requests_session
    ON deanonymization_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_deanonymization_requests_access_expires
    ON deanonymization_requests(access_expires_at)
    WHERE status = 'approved';

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_deanonymization_requests_updated_at ON deanonymization_requests;
CREATE TRIGGER update_deanonymization_requests_updated_at
    BEFORE UPDATE ON deanonymization_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE deanonymization_requests IS 'Requests to reveal the real identity behind an anonymous session participant';

-- ============================================
-- 6. review_configuration — singleton settings for review system
-- ============================================
CREATE TABLE IF NOT EXISTS review_configuration (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    min_reviews SMALLINT NOT NULL DEFAULT 3,
    max_reviews SMALLINT NOT NULL DEFAULT 5,
    criteria_threshold SMALLINT NOT NULL DEFAULT 7,
    auto_flag_threshold SMALLINT NOT NULL DEFAULT 4,
    variance_limit DECIMAL(3,1) NOT NULL DEFAULT 2.0,
    timeout_hours SMALLINT NOT NULL DEFAULT 24,
    high_risk_sla_hours SMALLINT NOT NULL DEFAULT 2,
    medium_risk_sla_hours SMALLINT NOT NULL DEFAULT 24,
    deanonymization_access_hours SMALLINT NOT NULL DEFAULT 24,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_review_configuration_updated_at ON review_configuration;
CREATE TRIGGER update_review_configuration_updated_at
    BEFORE UPDATE ON review_configuration
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE review_configuration IS 'Singleton row holding review-system-wide thresholds and SLA settings';

-- ============================================
-- 7. crisis_keywords — keyword / phrase dictionary for auto-detection
-- ============================================
CREATE TABLE IF NOT EXISTS crisis_keywords (
    id SERIAL PRIMARY KEY,
    keyword TEXT NOT NULL,
    language VARCHAR(5) NOT NULL,
    category VARCHAR(30) NOT NULL
        CHECK (category IN ('suicidal_ideation', 'self_harm', 'violence', 'other')),
    severity VARCHAR(10) NOT NULL DEFAULT 'high'
        CHECK (severity IN ('high', 'medium')),
    is_phrase BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for crisis_keywords
CREATE INDEX IF NOT EXISTS idx_crisis_keywords_language_active
    ON crisis_keywords(language, is_active);
CREATE INDEX IF NOT EXISTS idx_crisis_keywords_category
    ON crisis_keywords(category);

COMMENT ON TABLE crisis_keywords IS 'Dictionary of keywords and phrases for automated crisis detection';

-- ============================================
-- 8. anonymous_mappings — real ↔ anonymous identity pairs
-- ============================================
CREATE TABLE IF NOT EXISTS anonymous_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    real_user_id UUID NOT NULL,
    anonymous_id VARCHAR(10) NOT NULL,
    context_session_id UUID NOT NULL REFERENCES sessions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT anonymous_mappings_user_session_unique UNIQUE (real_user_id, context_session_id)
);

-- Indexes for anonymous_mappings
CREATE INDEX IF NOT EXISTS idx_anonymous_mappings_session
    ON anonymous_mappings(context_session_id);

COMMENT ON TABLE anonymous_mappings IS 'Maps real user IDs to anonymous identifiers within a session context';

-- ============================================
-- 9. review_notifications — in-app notification queue
-- ============================================
CREATE TABLE IF NOT EXISTS review_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(30) NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for review_notifications
CREATE INDEX IF NOT EXISTS idx_review_notifications_unread
    ON review_notifications(recipient_id, read_at)
    WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_review_notifications_event_created
    ON review_notifications(event_type, created_at);

COMMENT ON TABLE review_notifications IS 'In-app notifications for review events (assignments, completions, flags)';

-- ============================================
-- 10. ALTER sessions — add review & risk columns
-- ============================================
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending_review';

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS review_final_score DECIMAL(3,1);

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS review_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS reviews_required SMALLINT NOT NULL DEFAULT 3;

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS risk_level VARCHAR(10) DEFAULT 'none';

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS language VARCHAR(5);

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS auto_flagged BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS tiebreaker_reviewer_id UUID REFERENCES users(id);

-- Index on review_status for queue queries
CREATE INDEX IF NOT EXISTS idx_sessions_review_status
    ON sessions(review_status);

-- ============================================
-- 11. Seed review_configuration singleton row
-- ============================================
INSERT INTO review_configuration (
    id,
    min_reviews,
    max_reviews,
    criteria_threshold,
    auto_flag_threshold,
    variance_limit,
    timeout_hours,
    high_risk_sla_hours,
    medium_risk_sla_hours,
    deanonymization_access_hours
) VALUES (
    1, 3, 5, 7, 4, 2.0, 24, 2, 24, 24
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 12. Seed crisis_keywords — EN, UK, RU
-- ============================================

-- ---------- English (en) ----------

-- suicidal_ideation – en
INSERT INTO crisis_keywords (keyword, language, category, severity, is_phrase) VALUES
    ('suicide', 'en', 'suicidal_ideation', 'high', false),
    ('kill myself', 'en', 'suicidal_ideation', 'high', true),
    ('want to die', 'en', 'suicidal_ideation', 'high', true),
    ('end my life', 'en', 'suicidal_ideation', 'high', true),
    ('no reason to live', 'en', 'suicidal_ideation', 'high', true),
    ('suicidal thoughts', 'en', 'suicidal_ideation', 'high', true),
    ('better off dead', 'en', 'suicidal_ideation', 'high', true);

-- self_harm – en
INSERT INTO crisis_keywords (keyword, language, category, severity, is_phrase) VALUES
    ('self-harm', 'en', 'self_harm', 'high', false),
    ('cut myself', 'en', 'self_harm', 'high', true),
    ('hurt myself', 'en', 'self_harm', 'high', true),
    ('self-injury', 'en', 'self_harm', 'high', false),
    ('burning myself', 'en', 'self_harm', 'high', true),
    ('harming myself', 'en', 'self_harm', 'high', true);

-- violence – en
INSERT INTO crisis_keywords (keyword, language, category, severity, is_phrase) VALUES
    ('kill someone', 'en', 'violence', 'high', true),
    ('want to hurt', 'en', 'violence', 'high', true),
    ('going to attack', 'en', 'violence', 'high', true),
    ('bring a weapon', 'en', 'violence', 'high', true),
    ('murder', 'en', 'violence', 'high', false),
    ('shoot up', 'en', 'violence', 'high', true),
    ('bomb threat', 'en', 'violence', 'high', true);

-- ---------- Ukrainian (uk) ----------

-- suicidal_ideation – uk
INSERT INTO crisis_keywords (keyword, language, category, severity, is_phrase) VALUES
    ('суїцид', 'uk', 'suicidal_ideation', 'high', false),
    ('хочу померти', 'uk', 'suicidal_ideation', 'high', true),
    ('вбити себе', 'uk', 'suicidal_ideation', 'high', true),
    ('покінчити з життям', 'uk', 'suicidal_ideation', 'high', true),
    ('немає сенсу жити', 'uk', 'suicidal_ideation', 'high', true),
    ('суїцидальні думки', 'uk', 'suicidal_ideation', 'high', true),
    ('краще б мене не було', 'uk', 'suicidal_ideation', 'high', true);

-- self_harm – uk
INSERT INTO crisis_keywords (keyword, language, category, severity, is_phrase) VALUES
    ('самопошкодження', 'uk', 'self_harm', 'high', false),
    ('порізати себе', 'uk', 'self_harm', 'high', true),
    ('завдати собі болю', 'uk', 'self_harm', 'high', true),
    ('шкодити собі', 'uk', 'self_harm', 'high', true),
    ('ріжу себе', 'uk', 'self_harm', 'high', true),
    ('палити себе', 'uk', 'self_harm', 'high', true);

-- violence – uk
INSERT INTO crisis_keywords (keyword, language, category, severity, is_phrase) VALUES
    ('вбити когось', 'uk', 'violence', 'high', true),
    ('хочу нашкодити', 'uk', 'violence', 'high', true),
    ('напасти', 'uk', 'violence', 'high', false),
    ('зброя', 'uk', 'violence', 'medium', false),
    ('вбивство', 'uk', 'violence', 'high', false),
    ('погроза', 'uk', 'violence', 'medium', false),
    ('підірвати', 'uk', 'violence', 'high', false);

-- ---------- Russian (ru) ----------

-- suicidal_ideation – ru
INSERT INTO crisis_keywords (keyword, language, category, severity, is_phrase) VALUES
    ('суицид', 'ru', 'suicidal_ideation', 'high', false),
    ('хочу умереть', 'ru', 'suicidal_ideation', 'high', true),
    ('убить себя', 'ru', 'suicidal_ideation', 'high', true),
    ('покончить с собой', 'ru', 'suicidal_ideation', 'high', true),
    ('нет смысла жить', 'ru', 'suicidal_ideation', 'high', true),
    ('суицидальные мысли', 'ru', 'suicidal_ideation', 'high', true),
    ('лучше бы меня не было', 'ru', 'suicidal_ideation', 'high', true);

-- self_harm – ru
INSERT INTO crisis_keywords (keyword, language, category, severity, is_phrase) VALUES
    ('самоповреждение', 'ru', 'self_harm', 'high', false),
    ('порезать себя', 'ru', 'self_harm', 'high', true),
    ('причинить себе боль', 'ru', 'self_harm', 'high', true),
    ('навредить себе', 'ru', 'self_harm', 'high', true),
    ('режу себя', 'ru', 'self_harm', 'high', true),
    ('жгу себя', 'ru', 'self_harm', 'high', true);

-- violence – ru
INSERT INTO crisis_keywords (keyword, language, category, severity, is_phrase) VALUES
    ('убить кого-то', 'ru', 'violence', 'high', true),
    ('хочу навредить', 'ru', 'violence', 'high', true),
    ('напасть', 'ru', 'violence', 'high', false),
    ('оружие', 'ru', 'violence', 'medium', false),
    ('убийство', 'ru', 'violence', 'high', false),
    ('угроза', 'ru', 'violence', 'medium', false),
    ('взорвать', 'ru', 'violence', 'high', false);

COMMIT;
