-- ============================================
-- Session Messages Table Migration
-- ============================================
-- Stores individual messages to survive server restarts
-- 
-- Lifecycle:
-- 1. Messages stored here while session is active
-- 2. On session end: messages saved to GCS, then deleted from DB
-- 3. This ensures zero data loss even if server crashes
-- 4. Database stays clean - only active session messages kept

-- ============================================
-- Session Messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS session_messages (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Technical details from Dialogflow CX (stored as JSONB for querying)
    intent_info JSONB,
    match_info JSONB,
    generative_info JSONB,
    webhook_statuses JSONB,
    diagnostic_info JSONB,
    sentiment JSONB,
    flow_info JSONB,
    response_time_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_session_messages_session_id ON session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_timestamp ON session_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_session_messages_created_at ON session_messages(created_at);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE session_messages IS 'Individual chat messages - persisted to survive server restarts';
COMMENT ON COLUMN session_messages.session_id IS 'Reference to parent session';
COMMENT ON COLUMN session_messages.role IS 'Message sender: user or assistant';
COMMENT ON COLUMN session_messages.intent_info IS 'Intent information from Dialogflow CX';
COMMENT ON COLUMN session_messages.generative_info IS 'RAG and Chain of Thought data';
COMMENT ON COLUMN session_messages.diagnostic_info IS 'Advanced diagnostic information';

