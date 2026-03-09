-- ============================================
-- Add Feedback Column to Session Messages
-- ============================================
-- Adds user feedback (rating 1-5 and optional comment) to messages
-- NULL for backward compatibility with existing messages

-- Add feedback column
ALTER TABLE session_messages 
ADD COLUMN IF NOT EXISTS feedback JSONB;

-- Add comment
COMMENT ON COLUMN session_messages.feedback IS 'User feedback on message: {rating: 1-5, comment: string | null, submittedAt: ISO timestamp}';

