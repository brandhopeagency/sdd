-- ============================================
-- Chat Application Database Schema
-- PostgreSQL 15+
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Users Table
-- ============================================
-- ============================================
-- Groups Table
-- ============================================
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE,
    archived_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_groups_archived_at ON groups(archived_at);

COMMENT ON TABLE groups IS 'User groups for scoped administration and analytics';
COMMENT ON COLUMN groups.name IS 'Human-readable group name';
COMMENT ON COLUMN groups.archived_at IS 'When the group was archived (null = active)';
COMMENT ON COLUMN groups.archived_by IS 'User who archived the group (no FK in schema.sql to avoid circular refs)';

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    active_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    disapproved_at TIMESTAMP WITH TIME ZONE,
    disapproval_comment TEXT,
    disapproval_count INTEGER NOT NULL DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_role CHECK (role IN ('user', 'qa_specialist', 'researcher', 'moderator', 'owner', 'group_admin')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'blocked', 'pending', 'approval', 'disapproved', 'anonymized'))
);

-- ============================================
-- OTP Codes Table
-- ============================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Refresh Tokens Table
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Group Memberships + Invite Codes
-- ============================================
CREATE TABLE IF NOT EXISTS group_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_group_membership_role CHECK (role IN ('member', 'admin')),
    CONSTRAINT valid_group_membership_status CHECK (status IN ('active', 'pending', 'rejected', 'removed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_memberships_group_user ON group_memberships(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user_id ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group_id ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_status ON group_memberships(status);

CREATE TABLE IF NOT EXISTS group_invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    code VARCHAR(64) UNIQUE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER NOT NULL DEFAULT 1,
    uses INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT valid_invite_max_uses CHECK (max_uses >= 1),
    CONSTRAINT valid_invite_uses CHECK (uses >= 0)
);

CREATE INDEX IF NOT EXISTS idx_group_invite_codes_group_id ON group_invite_codes(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invite_codes_code ON group_invite_codes(code);

-- ============================================
-- Audit Log Table
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    guest_id TEXT,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_sessions_guest_id ON sessions(guest_id);
CREATE INDEX IF NOT EXISTS idx_sessions_group_id ON sessions(group_id);

-- ============================================
-- Session Messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS session_messages (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
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
    system_prompts JSONB,
    response_time_ms INTEGER,
    
    -- User feedback on message
    feedback JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);
CREATE INDEX IF NOT EXISTS idx_users_active_group_id ON users(active_group_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_dialogflow ON sessions(dialogflow_session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_messages_session_id ON session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_timestamp ON session_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_session_messages_created_at ON session_messages(created_at);

-- ============================================
-- Global Settings (single row)
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    guest_mode_enabled BOOLEAN NOT NULL DEFAULT false,
    approval_cooloff_days INTEGER NOT NULL DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_singleton ON settings(id);

-- ============================================
-- Updated At Trigger Function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to groups table
DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to group_memberships table
DROP TRIGGER IF EXISTS update_group_memberships_updated_at ON group_memberships;
CREATE TRIGGER update_group_memberships_updated_at
    BEFORE UPDATE ON group_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to sessions table
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to settings
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Cleanup Functions
-- ============================================

-- Function to clean up expired OTP codes
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM otp_codes WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE users IS 'User accounts for the chat application';
COMMENT ON TABLE groups IS 'User groups for scoped administration and analytics';
COMMENT ON TABLE otp_codes IS 'One-time password codes for email authentication';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for session management';
COMMENT ON TABLE audit_log IS 'Audit trail for administrative actions';
COMMENT ON TABLE sessions IS 'Chat session metadata - full conversations stored in GCS';
COMMENT ON TABLE session_messages IS 'Individual chat messages - persisted to survive server restarts';
COMMENT ON TABLE group_invite_codes IS 'Invitation codes per group';
COMMENT ON TABLE group_memberships IS 'User memberships in groups';
COMMENT ON TABLE settings IS 'Global application settings';

COMMENT ON COLUMN users.role IS 'User role: user, qa_specialist, researcher, moderator, owner';
COMMENT ON COLUMN users.status IS 'Account status: active, blocked, pending, approval, disapproved, anonymized';
COMMENT ON COLUMN users.group_id IS 'Optional group assignment for scoped administration';
COMMENT ON COLUMN users.approved_by IS 'User who approved the account';
COMMENT ON COLUMN users.approved_at IS 'Timestamp when account was approved';
COMMENT ON COLUMN users.disapproved_at IS 'Timestamp when account was disapproved';
COMMENT ON COLUMN users.disapproval_comment IS 'Admin comment for disapproval';
COMMENT ON COLUMN users.disapproval_count IS 'Number of disapproval events';
COMMENT ON COLUMN users.metadata IS 'Additional user metadata as JSON (e.g., blockReason, erasedAt)';
COMMENT ON COLUMN otp_codes.code_hash IS 'bcrypt hash of the OTP code';
COMMENT ON COLUMN otp_codes.attempts IS 'Number of verification attempts (max 3)';
COMMENT ON COLUMN sessions.user_id IS 'User who created the session (null for anonymous)';
COMMENT ON COLUMN sessions.group_id IS 'Group snapshot for this session (copied from users.group_id)';
COMMENT ON COLUMN sessions.dialogflow_session_id IS 'Dialogflow CX session identifier';
COMMENT ON COLUMN sessions.status IS 'Session status: active, ended, expired';
COMMENT ON COLUMN sessions.message_count IS 'Number of messages in the session';
COMMENT ON COLUMN sessions.language_code IS 'Language code for the session (uk, en, ru)';
COMMENT ON COLUMN sessions.gcs_path IS 'Path to conversation data in GCS bucket';
COMMENT ON COLUMN session_messages.session_id IS 'Reference to parent session';
COMMENT ON COLUMN session_messages.role IS 'Message sender: user or assistant';
COMMENT ON COLUMN session_messages.intent_info IS 'Intent information from Dialogflow CX';
COMMENT ON COLUMN session_messages.generative_info IS 'RAG and Chain of Thought data';
COMMENT ON COLUMN session_messages.diagnostic_info IS 'Advanced diagnostic information';
COMMENT ON COLUMN session_messages.system_prompts IS 'System prompts used for this turn (debug/moderation). Example: { agentMemorySystemMessages: [...] }';
COMMENT ON COLUMN session_messages.feedback IS 'User feedback on message: {rating: 1-5, comment: string | null, submittedAt: ISO timestamp}';

