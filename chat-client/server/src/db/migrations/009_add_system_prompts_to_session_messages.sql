-- ============================================
-- Add System Prompts Column to Session Messages
-- ============================================
-- Stores system prompts (e.g., agent memory messages) used for an assistant turn.
-- NULL for backward compatibility with existing messages.

ALTER TABLE session_messages
ADD COLUMN IF NOT EXISTS system_prompts JSONB;

COMMENT ON COLUMN session_messages.system_prompts IS 'System prompts used for this turn (debug/moderation). Example: { agentMemorySystemMessages: [{role:"system", content:"...", meta:{...}}] }';

