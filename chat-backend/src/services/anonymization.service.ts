import { createHash } from 'crypto';
import { getPool } from '../db';
import type { AnonymizedMessage } from '@mentalhelpglobal/chat-types';

const ANONYMIZATION_SALT = process.env.ANONYMIZATION_SALT || 'default-dev-salt';

/**
 * Generate a deterministic anonymous ID from a real ID.
 * Uses SHA-256 hash of (realId + salt), takes last 4 hex chars uppercase.
 * Returns `${prefix}-${hex}`.
 */
export function generateAnonymousId(realId: string, prefix: 'USER' | 'CHAT'): string {
  const hash = createHash('sha256')
    .update(realId + ANONYMIZATION_SALT)
    .digest('hex');
  const suffix = hash.slice(-4).toUpperCase();
  return `${prefix}-${suffix}`;
}

/**
 * Get an existing anonymous mapping or create a new one.
 * Looks up by (real_user_id, context_session_id) in anonymous_mappings table.
 * Returns the anonymous_id.
 */
export async function getOrCreateMapping(
  realUserId: string,
  contextSessionId: string,
): Promise<string> {
  const pool = getPool();

  // Check for existing mapping
  const existing = await pool.query(
    'SELECT anonymous_id FROM anonymous_mappings WHERE real_user_id = $1 AND context_session_id = $2',
    [realUserId, contextSessionId],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].anonymous_id;
  }

  // Create new mapping
  const anonymousId = generateAnonymousId(realUserId, 'USER');
  await pool.query(
    'INSERT INTO anonymous_mappings (real_user_id, context_session_id, anonymous_id) VALUES ($1, $2, $3)',
    [realUserId, contextSessionId, anonymousId],
  );

  return anonymousId;
}

/**
 * Anonymize session data by replacing userId fields with USER-XXXX
 * and sessionId fields with CHAT-XXXX.
 * Returns a new object (does not mutate the original).
 */
export function anonymizeSessionData(sessionData: any): any {
  if (sessionData === null || sessionData === undefined) {
    return sessionData;
  }

  if (typeof sessionData !== 'object') {
    return sessionData;
  }

  if (Array.isArray(sessionData)) {
    return sessionData.map((item) => anonymizeSessionData(item));
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(sessionData)) {
    if (
      (key === 'userId' || key === 'user_id') &&
      typeof value === 'string'
    ) {
      result[key] = generateAnonymousId(value, 'USER');
    } else if (
      (key === 'sessionId' || key === 'session_id') &&
      typeof value === 'string'
    ) {
      result[key] = generateAnonymousId(value, 'CHAT');
    } else if (typeof value === 'object' && value !== null) {
      result[key] = anonymizeSessionData(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Shorthand: generate an anonymous session ID (CHAT-XXXX) from a session ID.
 */
export function getAnonymousSessionId(sessionId: string): string {
  return generateAnonymousId(sessionId, 'CHAT');
}

/**
 * Load a session from the database and return anonymized session metadata.
 * Replaces real user/session IDs with USER-XXXX/CHAT-XXXX identifiers
 * using the anonymous_mappings table for deterministic mapping.
 */
export async function getAnonymizedSession(sessionId: string): Promise<{
  anonymousSessionId: string;
  anonymousUserId: string;
  messageCount: number;
  reviewStatus: string;
  reviewCount: number;
  reviewsRequired: number;
  reviewFinalScore: number | null;
  riskLevel: string;
  language: string | null;
  autoFlagged: boolean;
  startedAt: Date;
  endedAt: Date | null;
} | null> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, user_id, message_count, review_status, review_count,
            reviews_required, risk_level, language, auto_flagged,
            started_at, ended_at, review_final_score
     FROM sessions WHERE id = $1`,
    [sessionId],
  );

  if (result.rows.length === 0) return null;

  const session = result.rows[0];

  // Use the anonymous_mappings table for deterministic mapping
  const anonymousUserId = session.user_id
    ? await getOrCreateMapping(session.user_id, sessionId).catch(
        () => generateAnonymousId(session.user_id, 'USER'),
      )
    : 'USER-ANON';

  return {
    anonymousSessionId: getAnonymousSessionId(sessionId),
    anonymousUserId,
    messageCount: Number(session.message_count ?? 0),
    reviewStatus: session.review_status ?? 'pending_review',
    reviewCount: Number(session.review_count ?? 0),
    reviewsRequired: Number(session.reviews_required ?? 3),
    reviewFinalScore: session.review_final_score != null
      ? Number(session.review_final_score)
      : null,
    riskLevel: session.risk_level ?? 'none',
    language: session.language ?? null,
    autoFlagged: Boolean(session.auto_flagged),
    startedAt: session.started_at,
    endedAt: session.ended_at ?? null,
  };
}

/**
 * Load messages for a session and return them in anonymized format.
 * Only user and assistant messages are returned (system messages excluded).
 * The `isReviewable` flag is true only for assistant messages.
 */
export async function getAnonymizedMessages(
  sessionId: string,
): Promise<AnonymizedMessage[]> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, role, content, created_at AS timestamp,
            generative_info, intent_info
     FROM session_messages
     WHERE session_id = $1 AND role IN ('user', 'assistant')
     ORDER BY created_at ASC`,
    [sessionId],
  );

  return result.rows.map((msg: any): AnonymizedMessage => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    metadata: {
      confidence: msg.generative_info?.confidence ?? undefined,
      intent: msg.intent_info?.displayName ?? undefined,
    },
    isReviewable: msg.role === 'assistant',
  }));
}
