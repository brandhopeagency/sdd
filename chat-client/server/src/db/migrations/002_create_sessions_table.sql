-- ============================================
-- Sessions Table Migration
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    dialogflow_session_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    message_count INTEGER DEFAULT 0,
    language_code VARCHAR(10) DEFAULT 'uk',
    gcs_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN ('active', 'ended', 'expired'))
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_dialogflow ON sessions(dialogflow_session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

-- ============================================
-- Updated At Trigger
-- ============================================
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE sessions IS 'Chat session metadata - full conversations stored in GCS';
COMMENT ON COLUMN sessions.user_id IS 'User who created the session (null for anonymous)';
COMMENT ON COLUMN sessions.dialogflow_session_id IS 'Dialogflow CX session identifier';
COMMENT ON COLUMN sessions.status IS 'Session status: active, ended, expired';
COMMENT ON COLUMN sessions.message_count IS 'Number of messages in the session';
COMMENT ON COLUMN sessions.language_code IS 'Language code for the session (uk, en, ru)';
COMMENT ON COLUMN sessions.gcs_path IS 'Path to conversation data in GCS bucket';

