-- ============================================
-- Allow system messages in session_messages.role
-- ============================================
-- Needed for non-blocking memory updates that append persisted system markers
-- and for compatibility with future system-level events.

DO $$
BEGIN
  IF to_regclass('public.session_messages') IS NULL THEN
    -- Table doesn't exist yet; nothing to do.
    RETURN;
  END IF;

  -- Default auto-generated constraint name for inline CHECK on column `role`
  -- is usually `session_messages_role_check`.
  EXECUTE 'ALTER TABLE session_messages DROP CONSTRAINT IF EXISTS session_messages_role_check';

  EXECUTE $sql$
    ALTER TABLE session_messages
      ADD CONSTRAINT session_messages_role_check
      CHECK (role IN ('user', 'assistant', 'system'))
  $sql$;
END $$;


