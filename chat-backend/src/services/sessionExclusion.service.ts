import { getPool } from '../db';

// ── Types ──

export interface ExclusionRecord {
  id: string;
  sessionId: string;
  reason: string;
  reasonSource: 'user_tag' | 'chat_tag';
  tagDefinitionId: string | null;
  createdAt: Date;
}

// ── Row mapper ──

function rowToExclusionRecord(row: any): ExclusionRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    reason: row.reason,
    reasonSource: row.reason_source,
    tagDefinitionId: row.tag_definition_id ?? null,
    createdAt: row.created_at,
  };
}

// ── Service functions ──

/**
 * Evaluate a session for review exclusion.
 *
 * 1. Looks up the session's user_id.
 * 2. Checks if the user has any tags where the tag definition has exclude_from_reviews = true.
 *    If so, creates a session_exclusions entry with reason_source = 'user_tag'.
 * 3. Counts user + assistant messages for the session and compares against
 *    review_configuration.min_message_threshold. If below the threshold, looks up the
 *    "short" tag definition, creates a session_tags entry (source = 'system'), and creates
 *    a session_exclusions entry with reason_source = 'chat_tag'.
 * 4. Returns all exclusions created during this evaluation.
 */
export async function evaluateSession(sessionId: string): Promise<ExclusionRecord[]> {
  const pool = getPool();
  const exclusions: ExclusionRecord[] = [];

  // 1. Find the session's user_id
  const sessionResult = await pool.query(
    'SELECT user_id FROM sessions WHERE id = $1',
    [sessionId],
  );

  if (sessionResult.rows.length === 0) {
    const error: any = new Error('Session not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const userId: string | null = sessionResult.rows[0].user_id;

  // 2. Check user-tag exclusions (only if session has a user)
  if (userId) {
    const userExclusionTags = await pool.query(
      `SELECT td.id, td.name
       FROM user_tags ut
       JOIN tag_definitions td ON td.id = ut.tag_definition_id
       WHERE ut.user_id = $1
         AND td.exclude_from_reviews = true
         AND td.is_active = true`,
      [userId],
    );

    for (const tagRow of userExclusionTags.rows) {
      // Avoid duplicate exclusion records for the same session + tag
      const existing = await pool.query(
        `SELECT id FROM session_exclusions
         WHERE session_id = $1 AND tag_definition_id = $2 AND reason_source = 'user_tag'`,
        [sessionId, tagRow.id],
      );

      if (existing.rows.length === 0) {
        const insertResult = await pool.query(
          `INSERT INTO session_exclusions (session_id, reason, reason_source, tag_definition_id)
           VALUES ($1, $2, 'user_tag', $3)
           RETURNING *`,
          [sessionId, `User tagged: ${tagRow.name}`, tagRow.id],
        );
        exclusions.push(rowToExclusionRecord(insertResult.rows[0]));
      }
    }
  }

  // 3. Check short-chat exclusion
  const messageCountResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM session_messages
     WHERE session_id = $1 AND role IN ('user', 'assistant')`,
    [sessionId],
  );
  const messageCount = messageCountResult.rows[0]?.count ?? 0;

  const configResult = await pool.query(
    'SELECT min_message_threshold FROM review_configuration WHERE id = 1',
  );
  const minThreshold = configResult.rows[0]?.min_message_threshold ?? 4;

  if (messageCount < minThreshold) {
    // Look up the "short" tag definition
    const shortTagResult = await pool.query(
      `SELECT id, name FROM tag_definitions WHERE LOWER(name) = 'short' AND category = 'chat'`,
    );

    if (shortTagResult.rows.length > 0) {
      const shortTag = shortTagResult.rows[0];

      // Apply session tag (source = 'system'), ignore conflict if already applied
      await pool.query(
        `INSERT INTO session_tags (session_id, tag_definition_id, source)
         VALUES ($1, $2, 'system')
         ON CONFLICT (session_id, tag_definition_id) DO NOTHING`,
        [sessionId, shortTag.id],
      );

      // Create exclusion record (avoid duplicates)
      const existingExclusion = await pool.query(
        `SELECT id FROM session_exclusions
         WHERE session_id = $1 AND tag_definition_id = $2 AND reason_source = 'chat_tag'`,
        [sessionId, shortTag.id],
      );

      if (existingExclusion.rows.length === 0) {
        const insertResult = await pool.query(
          `INSERT INTO session_exclusions (session_id, reason, reason_source, tag_definition_id)
           VALUES ($1, $2, 'chat_tag', $3)
           RETURNING *`,
          [
            sessionId,
            `Short chat: ${messageCount} messages (minimum: ${minThreshold})`,
            shortTag.id,
          ],
        );
        exclusions.push(rowToExclusionRecord(insertResult.rows[0]));
      }
    }
  }

  return exclusions;
}

/**
 * List all exclusion records for a session.
 */
export async function getSessionExclusions(sessionId: string): Promise<ExclusionRecord[]> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT * FROM session_exclusions WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId],
  );

  return result.rows.map(rowToExclusionRecord);
}
