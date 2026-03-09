-- ============================================
-- Delete empty (0-message) sessions
-- ============================================
-- "Empty session" definition:
-- - message_count is 0 (or NULL)
-- - there are no rows in session_messages
--
-- This will NOT delete ended sessions that had messages and were later
-- offloaded to GCS because those sessions have message_count > 0.

DELETE FROM sessions s
WHERE COALESCE(s.message_count, 0) = 0
  AND NOT EXISTS (
    SELECT 1
    FROM session_messages m
    WHERE m.session_id = s.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM session_reviews sr
    WHERE sr.session_id = s.id
  );

