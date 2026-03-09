/**
 * Session Management Service
 * 
 * Manages chat sessions: creates sessions in database, tracks messages in-memory,
 * and saves complete conversations to GCS when sessions end.
 */

import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db';
import type { SessionMetadata, StoredConversation, StoredMessage } from '../types/conversation';
import { saveConversation, deleteConversation } from './gcs.service';
import type { AgentMemorySystemMessage } from '../types/agentMemory';

function isUuid(value: string): boolean {
  // Simple UUID v4-ish check (also accepts other UUID versions)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeUserIdForDb(userId: string | null): string | null {
  // sessions.user_id is UUID FK; keep guests/unknown as NULL
  if (!userId) return null;
  return isUuid(userId) ? userId : null;
}

function normalizeGuestIdForDb(userId: string | null): string | null {
  if (!userId) return null;
  // Allow guest IDs to be persisted separately from the UUID FK.
  if (userId.startsWith('guest_')) return userId;
  return null;
}

async function getGroupIdForUserId(userId: string | null): Promise<string | null> {
  const pool = getPool();
  const uuidUserId = normalizeUserIdForDb(userId);
  if (!uuidUserId) return null;

  try {
    const result = await pool.query(`SELECT COALESCE(active_group_id, group_id) AS group_id FROM users WHERE id = $1`, [
      uuidUserId
    ]);
    const groupId = result.rows[0]?.group_id ?? null;
    return groupId;
  } catch {
    // Best-effort: group scoping should not break chat sessions.
    return null;
  }
}

/**
 * In-memory storage for active sessions
 * Maps sessionId -> StoredConversation
 */
const activeSessions = new Map<string, StoredConversation>();

/**
 * Best-effort per-session agent memory (system messages) cache.
 * IMPORTANT: cache is keyed by sessionId but ALSO carries the principalId it belongs to,
 * to prevent accidental cross-user injection (e.g., guest -> authenticated mid-session).
 */
const sessionAgentMemory = new Map<
  string,
  {
    principalId: string | null;
    messages: AgentMemorySystemMessage[];
  }
>();

export function setSessionAgentMemoryMessages(
  sessionId: string,
  principalId: string | null,
  memory: AgentMemorySystemMessage[]
): void {
  sessionAgentMemory.set(sessionId, { principalId, messages: memory });
}

export function getSessionAgentMemoryMessages(sessionId: string): {
  principalId: string | null;
  messages: AgentMemorySystemMessage[];
} {
  return sessionAgentMemory.get(sessionId) || { principalId: null, messages: [] };
}

/**
 * Ensure a session row exists in the database.
 *
 * Historical note: we used to create sessions lazily on first message to avoid 0-message sessions in DB.
 * We now also persist on session creation so we can enforce:
 * - single active session per principal across instances
 * - inactivity timeout expiry based on sessions.last_activity_at
 *
 * Empty sessions are still deleted on end/expiry.
 */
async function ensureSessionPersisted(sessionId: string): Promise<boolean> {
  const pool = getPool();

  const exists = await pool.query(`SELECT 1 FROM sessions WHERE id = $1`, [sessionId]);
  if (exists.rows.length > 0) return false;

  const conversation = activeSessions.get(sessionId);
  if (!conversation) {
    throw new Error(`Cannot persist session not in memory: ${sessionId}`);
  }

  const startedAt = new Date(conversation.startedAt);
  const now = new Date();
  const groupId = await getGroupIdForUserId(conversation.userId);

  try {
    await pool.query(
      `INSERT INTO sessions (
        id, user_id, guest_id, group_id, dialogflow_session_id,
        status, started_at, message_count, language_code,
        created_at, updated_at, last_activity_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        sessionId,
        normalizeUserIdForDb(conversation.userId),
        normalizeGuestIdForDb(conversation.userId),
        groupId,
        conversation.metadata.dialogflowSessionId,
        'active',
        startedAt,
        0,
        conversation.metadata.languageCode,
        now,
        now,
        now
      ]
    );
  } catch (error: any) {
    // Backward compatibility: if last_activity_at or group_id don't exist yet, retry without them.
    if (error?.code === '42703') {
      try {
        await pool.query(
          `INSERT INTO sessions (
            id, user_id, guest_id, group_id, dialogflow_session_id,
            status, started_at, message_count, language_code,
            created_at, updated_at
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            sessionId,
            normalizeUserIdForDb(conversation.userId),
            normalizeGuestIdForDb(conversation.userId),
            groupId,
            conversation.metadata.dialogflowSessionId,
            'active',
            startedAt,
            0,
            conversation.metadata.languageCode,
            now,
            now
          ]
        );
      } catch (fallbackError: any) {
        if (fallbackError?.code === '42703') {
          await pool.query(
            `INSERT INTO sessions (id, user_id, guest_id, dialogflow_session_id, status, started_at, message_count, language_code, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              sessionId,
              normalizeUserIdForDb(conversation.userId),
              normalizeGuestIdForDb(conversation.userId),
              conversation.metadata.dialogflowSessionId,
              'active',
              startedAt,
              0,
              conversation.metadata.languageCode,
              now,
              now
            ]
          );
        } else {
          throw fallbackError;
        }
      }
    } else {
      throw error;
    }
  }

  return true;
}

/**
 * Create a new session (persisted immediately so other instances/jobs can see it)
 */
export async function createSession(
  userId: string | null,
  languageCode: string = 'uk'
): Promise<SessionMetadata> {
  const sessionId = uuidv4();
  const dialogflowSessionId = `df_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = new Date();
  
  // Initialize in-memory conversation
  const conversation: StoredConversation = {
    sessionId,
    userId,
    startedAt: now.toISOString(),
    endedAt: '', // Empty for active sessions, will be set when session ends
    status: 'active',
    messages: [],
    metadata: {
      messageCount: 0,
      languageCode,
      dialogflowSessionId,
      environment: process.env.NODE_ENV || 'development'
    }
  };
  
  activeSessions.set(sessionId, conversation);
  sessionAgentMemory.set(sessionId, { principalId: userId, messages: [] });

  console.log(`[Session] Created in-memory session: ${sessionId} for user: ${userId || 'anonymous'}`);

  // Persist immediately so "single active session" and expiry logic work across Cloud Run instances.
  try {
    await ensureSessionPersisted(sessionId);
  } catch (e) {
    console.warn('[Session] Failed to persist session on create (continuing):', e);
  }

  return {
    id: sessionId,
    userId,
    dialogflowSessionId,
    status: 'active',
    startedAt: now,
    endedAt: null,
    messageCount: 0,
    languageCode,
    gcsPath: null,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Add a message to an active session
 * Messages are stored both in memory and persisted to database to survive server restarts
 */
export async function addMessage(sessionId: string, message: StoredMessage): Promise<void> {
  const pool = getPool();
  
  // Get or restore conversation from database
  let conversation = activeSessions.get(sessionId);
  
  if (!conversation) {
    console.warn(`[Session] Session not in memory, attempting to restore from database: ${sessionId}`);
    // Try to restore from database
    const sessionMetadata = await getSessionMetadata(sessionId);
    if (!sessionMetadata || sessionMetadata.status !== 'active') {
      throw new Error(`Session not found or not active: ${sessionId}`);
    }
    
    // Restore conversation structure
    conversation = {
      sessionId,
      userId: sessionMetadata.userId,
      startedAt: sessionMetadata.startedAt.toISOString(),
      endedAt: '',
      status: 'active',
      messages: [],
      metadata: {
        messageCount: 0,
        languageCode: sessionMetadata.languageCode,
        dialogflowSessionId: sessionMetadata.dialogflowSessionId,
        environment: process.env.NODE_ENV || 'development'
      }
    };
    
    // Load existing messages from database
    const messagesResult = await pool.query(
      `SELECT * FROM session_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    
    conversation.messages = messagesResult.rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      intent: row.intent_info ? (typeof row.intent_info === 'string' ? JSON.parse(row.intent_info) : row.intent_info) : undefined,
      match: row.match_info ? (typeof row.match_info === 'string' ? JSON.parse(row.match_info) : row.match_info) : undefined,
      generativeInfo: row.generative_info ? (typeof row.generative_info === 'string' ? JSON.parse(row.generative_info) : row.generative_info) : undefined,
      webhookStatuses: row.webhook_statuses ? (typeof row.webhook_statuses === 'string' ? JSON.parse(row.webhook_statuses) : row.webhook_statuses) : undefined,
      diagnosticInfo: row.diagnostic_info ? (typeof row.diagnostic_info === 'string' ? JSON.parse(row.diagnostic_info) : row.diagnostic_info) : undefined,
      sentiment: row.sentiment ? (typeof row.sentiment === 'string' ? JSON.parse(row.sentiment) : row.sentiment) : undefined,
      flowInfo: row.flow_info ? (typeof row.flow_info === 'string' ? JSON.parse(row.flow_info) : row.flow_info) : undefined,
      systemPrompts: row.system_prompts ? (typeof row.system_prompts === 'string' ? JSON.parse(row.system_prompts) : row.system_prompts) : undefined,
      responseTimeMs: row.response_time_ms,
      feedback: row.feedback ? (typeof row.feedback === 'string' ? JSON.parse(row.feedback) : row.feedback) : undefined
    }));
    
    conversation.metadata.messageCount = conversation.messages.length;
    activeSessions.set(sessionId, conversation);
    console.log(`[Session] Restored session from database with ${conversation.messages.length} messages`);
  }

  // Persist session lazily on first message (prevents 0-message sessions in DB)
  const insertedSessionRow = await ensureSessionPersisted(sessionId);

  // Update in-memory first, then persist; roll back memory on DB failure.
  conversation.messages.push(message);
  conversation.metadata.messageCount = conversation.messages.length;

  try {
    // Persist message to database
    await pool.query(
      `INSERT INTO session_messages (
        id, session_id, role, content, timestamp,
        intent_info, match_info, generative_info, webhook_statuses,
        diagnostic_info, sentiment, flow_info, system_prompts, response_time_ms, feedback
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        message.id,
        sessionId,
        message.role,
        message.content,
        message.timestamp,
        message.intent ? JSON.stringify(message.intent) : null,
        message.match ? JSON.stringify(message.match) : null,
        message.generativeInfo ? JSON.stringify(message.generativeInfo) : null,
        message.webhookStatuses ? JSON.stringify(message.webhookStatuses) : null,
        message.diagnosticInfo ? JSON.stringify(message.diagnosticInfo) : null,
        message.sentiment ? JSON.stringify(message.sentiment) : null,
        message.flowInfo ? JSON.stringify(message.flowInfo) : null,
        (message as any).systemPrompts ? JSON.stringify((message as any).systemPrompts) : null,
        message.responseTimeMs || null,
        message.feedback ? JSON.stringify(message.feedback) : null
      ]
    );

    // Update message count in sessions table
    try {
      await pool.query(
        `UPDATE sessions
         SET message_count = $1, updated_at = NOW(), last_activity_at = NOW()
         WHERE id = $2`,
        [conversation.messages.length, sessionId]
      );
    } catch (error: any) {
      if (error?.code === '42703') {
        await pool.query(
          `UPDATE sessions SET message_count = $1, updated_at = NOW() WHERE id = $2`,
          [conversation.messages.length, sessionId]
        );
      } else {
        throw error;
      }
    }
  } catch (error) {
    // Roll back memory update
    conversation.messages = conversation.messages.filter(m => m.id !== message.id);
    conversation.metadata.messageCount = conversation.messages.length;

    // If we just created the session row and couldn't insert any message,
    // remove the empty session row to uphold the "no 0-message sessions" rule.
    if (insertedSessionRow) {
      try {
        await pool.query(
          `DELETE FROM sessions s
           WHERE s.id = $1
             AND COALESCE(s.message_count, 0) = 0
             AND NOT EXISTS (SELECT 1 FROM session_messages m WHERE m.session_id = s.id)`,
          [sessionId]
        );
      } catch {
        // best-effort cleanup
      }
    }

    throw error;
  }

  console.log(`[Session] Added message to session: ${sessionId} (total: ${conversation.messages.length})`);
}

/**
 * End a session: save to GCS and update database
 * Loads messages from database if session not in memory (e.g., after server restart)
 */
export async function endSession(
  sessionId: string,
  opts?: { finalStatus?: 'ended' | 'expired' }
): Promise<StoredConversation | null> {
  const pool = getPool();
  const finalStatus: 'ended' | 'expired' = opts?.finalStatus || 'ended';
  let conversation = activeSessions.get(sessionId);
  
  if (!conversation) {
    console.warn(`[Session] Session not in memory, attempting to restore from database: ${sessionId}`);
    
    // Try to restore from database
    const sessionMetadata = await getSessionMetadata(sessionId);
    if (!sessionMetadata) {
      console.error(`[Session] Cannot end session - not found in database: ${sessionId}`);
      return null;
    }
    
    // Restore conversation structure
    conversation = {
      sessionId,
      userId: sessionMetadata.userId,
      startedAt: sessionMetadata.startedAt.toISOString(),
      endedAt: '',
      status: 'active',
      messages: [],
      metadata: {
        messageCount: 0,
        languageCode: sessionMetadata.languageCode,
        dialogflowSessionId: sessionMetadata.dialogflowSessionId,
        environment: process.env.NODE_ENV || 'development'
      }
    };
    
    // Load messages from database
    const messagesResult = await pool.query(
      `SELECT * FROM session_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    
    conversation.messages = messagesResult.rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      intent: row.intent_info ? (typeof row.intent_info === 'string' ? JSON.parse(row.intent_info) : row.intent_info) : undefined,
      match: row.match_info ? (typeof row.match_info === 'string' ? JSON.parse(row.match_info) : row.match_info) : undefined,
      generativeInfo: row.generative_info ? (typeof row.generative_info === 'string' ? JSON.parse(row.generative_info) : row.generative_info) : undefined,
      webhookStatuses: row.webhook_statuses ? (typeof row.webhook_statuses === 'string' ? JSON.parse(row.webhook_statuses) : row.webhook_statuses) : undefined,
      diagnosticInfo: row.diagnostic_info ? (typeof row.diagnostic_info === 'string' ? JSON.parse(row.diagnostic_info) : row.diagnostic_info) : undefined,
      sentiment: row.sentiment ? (typeof row.sentiment === 'string' ? JSON.parse(row.sentiment) : row.sentiment) : undefined,
      flowInfo: row.flow_info ? (typeof row.flow_info === 'string' ? JSON.parse(row.flow_info) : row.flow_info) : undefined,
      systemPrompts: row.system_prompts ? (typeof row.system_prompts === 'string' ? JSON.parse(row.system_prompts) : row.system_prompts) : undefined,
      responseTimeMs: row.response_time_ms,
      feedback: row.feedback ? (typeof row.feedback === 'string' ? JSON.parse(row.feedback) : row.feedback) : undefined
    }));
    
    conversation.metadata.messageCount = conversation.messages.length;
    console.log(`[Session] Restored session from database with ${conversation.messages.length} messages`);
  }

  // If there are no messages, don't store anything; delete the session record if it exists.
  if (conversation.messages.length === 0) {
    try {
      await pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
    } catch (error: any) {
      // Ignore "table does not exist" error (happens before migration runs)
      if (error.code !== '42P01') {
        throw error;
      }
    } finally {
      activeSessions.delete(sessionId);
      sessionAgentMemory.delete(sessionId);
    }
    console.log(`[Session] Deleted empty session (0 messages): ${sessionId}`);
    return null;
  }

  const reviewMessageCount = conversation.messages.filter((m) => m.role !== 'system').length;

  // Skip review storage for very short conversations, but still return the conversation for memory enrichment.
  if (reviewMessageCount < 4) {
    conversation.endedAt = new Date().toISOString();
    conversation.status = finalStatus;
    try {
      await deleteConversation(conversation.userId ?? null, sessionId);
    } catch (e) {
      console.warn('[Session] Failed to delete short conversation from GCS (continuing):', e);
    }
    try {
      await pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
    } catch (error: any) {
      if (error.code !== '42P01') {
        throw error;
      }
    } finally {
      activeSessions.delete(sessionId);
      sessionAgentMemory.delete(sessionId);
    }
    console.log(`[Session] Dropped short session (${reviewMessageCount} review messages): ${sessionId}`);
    return conversation;
  }

  // Update conversation end time and status
  conversation.endedAt = new Date().toISOString();
  conversation.status = finalStatus;

  // Save to GCS (both JSON and JSONL)
  const { jsonPath } = await saveConversation(conversation);

  // Update database with GCS path
  await pool.query(
    `UPDATE sessions 
     SET status = $1, ended_at = NOW(), gcs_path = $2, updated_at = NOW() 
     WHERE id = $3`,
    [finalStatus, jsonPath, sessionId]
  );

  // Evaluate session for review exclusions (user-tag, short-chat checks)
  // Must run BEFORE messages are deleted since evaluateSession counts messages.
  try {
    const { evaluateSession } = await import('./sessionExclusion.service');
    const exclusions = await evaluateSession(sessionId);
    if (exclusions.length > 0) {
      console.log(`[Session] Session ${sessionId} excluded from review: ${exclusions.map((e) => e.reason).join(', ')}`);
    }
  } catch (evalError) {
    // Non-fatal: log and continue — session is already saved
    console.warn('[Session] Failed to evaluate session for exclusions (continuing):', evalError);
  }

  // Delete messages from database (now saved in GCS)
  const deleteResult = await pool.query(
    `DELETE FROM session_messages WHERE session_id = $1`,
    [sessionId]
  );
  console.log(`[Session] Deleted ${deleteResult.rowCount} messages from database (saved in GCS)`);

  // Remove from memory
  activeSessions.delete(sessionId);
  sessionAgentMemory.delete(sessionId);

  console.log(`[Session] Closed session (${finalStatus}): ${sessionId}, saved to GCS: ${jsonPath}`);
  return conversation;
}

/**
 * Get session metadata from database
 */
export async function getSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
  const pool = getPool();

  // Prefer in-memory session if present (important for active sessions and guest sessions)
  const inMemory = activeSessions.get(sessionId);
  if (inMemory) {
    const startedAt = new Date(inMemory.startedAt);
    const endedAt = inMemory.endedAt ? new Date(inMemory.endedAt) : null;
    const now = new Date();

    return {
      id: sessionId,
      userId: inMemory.userId,
      dialogflowSessionId: inMemory.metadata.dialogflowSessionId,
      status: inMemory.status,
      startedAt,
      endedAt,
      messageCount: inMemory.metadata.messageCount,
      languageCode: inMemory.metadata.languageCode,
      gcsPath: null,
      createdAt: startedAt,
      updatedAt: now
    };
  }

  // sessions.id is UUID in Postgres; querying with arbitrary strings throws 22P02.
  // If a client sends a non-UUID session id (e.g., local fallback ids like "sess_..."),
  // treat it as "not found" instead of raising a 500.
  if (!isUuid(sessionId)) {
    return null;
  }

  const result = await pool.query(
    `SELECT * FROM sessions WHERE id = $1`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id || row.guest_id || null,
    dialogflowSessionId: row.dialogflow_session_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    messageCount: row.message_count,
    languageCode: row.language_code,
    gcsPath: row.gcs_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get active conversation from memory
 */
export function getActiveConversation(sessionId: string): StoredConversation | null {
  return activeSessions.get(sessionId) || null;
}

/**
 * List all sessions for a user
 */
export async function listUserSessions(userId: string, limit: number = 50): Promise<SessionMetadata[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM sessions 
     WHERE user_id = $1 
     ORDER BY started_at DESC 
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    dialogflowSessionId: row.dialogflow_session_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    messageCount: row.message_count,
    languageCode: row.language_code,
    gcsPath: row.gcs_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/**
 * Close (status flip) all other active sessions for a principal.
 * This enforces "only one active session" quickly, without blocking on GCS saving.
 *
 * Returns the ids of sessions that were transitioned from active -> closedStatus.
 */
export async function markOtherActiveSessionsClosed(input: {
  principalId: string;
  keepSessionId?: string;
  closedStatus: 'ended' | 'expired';
}): Promise<string[]> {
  const pool = getPool();
  const { principalId, keepSessionId, closedStatus } = input;

  // Best-effort: also close any in-memory sessions on this instance
  for (const [sid, conv] of activeSessions.entries()) {
    if (keepSessionId && sid === keepSessionId) continue;
    if (conv.userId === principalId && conv.status === 'active') {
      conv.status = closedStatus;
      conv.endedAt = new Date().toISOString();
    }
  }

  if (isUuid(principalId)) {
    const result = keepSessionId
      ? await pool.query(
          `UPDATE sessions
           SET status = $1, ended_at = NOW(), updated_at = NOW()
           WHERE status = 'active'
             AND user_id = $2
             AND id <> $3
           RETURNING id`,
          [closedStatus, principalId, keepSessionId]
        )
      : await pool.query(
          `UPDATE sessions
           SET status = $1, ended_at = NOW(), updated_at = NOW()
           WHERE status = 'active'
             AND user_id = $2
           RETURNING id`,
          [closedStatus, principalId]
        );

    return result.rows.map((r: any) => String(r.id));
  }

  if (typeof principalId === 'string' && principalId.startsWith('guest_')) {
    const result = keepSessionId
      ? await pool.query(
          `UPDATE sessions
           SET status = $1, ended_at = NOW(), updated_at = NOW()
           WHERE status = 'active'
             AND guest_id = $2
             AND id <> $3
           RETURNING id`,
          [closedStatus, principalId, keepSessionId]
        )
      : await pool.query(
          `UPDATE sessions
           SET status = $1, ended_at = NOW(), updated_at = NOW()
           WHERE status = 'active'
             AND guest_id = $2
           RETURNING id`,
          [closedStatus, principalId]
        );

    return result.rows.map((r: any) => String(r.id));
  }

  return [];
}

/**
 * Expire old active sessions (cleanup job)
 */
export async function expireOldSessions(maxAgeMinutes: number = 30): Promise<number> {
  const pool = getPool();
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  // Mark sessions expired first (fast), so they stop accepting messages immediately.
  let result;
  try {
    result = await pool.query(
      `UPDATE sessions
       SET status = 'expired', ended_at = NOW(), updated_at = NOW()
       WHERE status = 'active'
         AND COALESCE(last_activity_at, updated_at, started_at) < $1
       RETURNING id`,
      [cutoffTime]
    );
  } catch (error: any) {
    if (error?.code === '42703') {
      result = await pool.query(
        `UPDATE sessions
         SET status = 'expired', ended_at = NOW(), updated_at = NOW()
         WHERE status = 'active' AND updated_at < $1
         RETURNING id`,
        [cutoffTime]
      );
    } else {
      throw error;
    }
  }

  let expiredCount = 0;

  // End each session (will save to GCS)
  for (const row of result.rows as Array<{ id: string }>) {
    try {
      await endSession(row.id, { finalStatus: 'expired' });
      expiredCount++;
    } catch (error) {
      console.error(`[Session] Failed to expire session ${row.id}:`, error);
    }
  }

  if (expiredCount > 0) {
    console.log(`[Session] Expired ${expiredCount} old sessions`);
  }

  return expiredCount;
}

/**
 * Clean up messages for ended sessions that are already saved to GCS
 * This is a maintenance job to keep the database clean
 */
export async function cleanupEndedSessionMessages(): Promise<number> {
  const pool = getPool();
  
  try {
    // Delete messages for sessions that are ended AND have GCS path
    const result = await pool.query(
      `DELETE FROM session_messages 
       WHERE session_id IN (
         SELECT id FROM sessions 
         WHERE status = 'ended' AND gcs_path IS NOT NULL
       )`
    );
    
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`[Session] Cleaned up ${deletedCount} messages from ended sessions`);
    }
    
    return deletedCount;
  } catch (error: any) {
    // Ignore "table does not exist" error (happens before migration runs)
    if (error.code === '42P01') {
      console.log('[Session] Skipping cleanup - session_messages table does not exist yet');
      return 0;
    }
    throw error;
  }
}

/**
 * Update feedback for a message
 */
export async function updateMessageFeedback(
  sessionId: string,
  messageId: string,
  feedback: { rating: 1 | 2 | 3 | 4 | 5; comment: string | null }
): Promise<void> {
  const pool = getPool();
  
  // Prepare feedback object with timestamp
  const feedbackData = {
    rating: feedback.rating,
    comment: feedback.comment,
    submittedAt: new Date().toISOString()
  };
  
  // Update in database
  await pool.query(
    `UPDATE session_messages 
     SET feedback = $1 
     WHERE id = $2 AND session_id = $3`,
    [JSON.stringify(feedbackData), messageId, sessionId]
  );
  
  // Update in memory if session is active
  const conversation = activeSessions.get(sessionId);
  if (conversation) {
    const message = conversation.messages.find(msg => msg.id === messageId);
    if (message) {
      message.feedback = feedbackData;
    }
  }
  
  console.log(`[Session] Updated feedback for message ${messageId} in session ${sessionId}`);
}

/**
 * Update session userId (e.g., when guest user authenticates)
 */
export async function updateSessionUserId(
  sessionId: string,
  userId: string
): Promise<void> {
  // Only update user_id if userId is a valid UUID (not a guest_* ID)
  // Guest IDs should not be written to the user_id column (which is UUID type)
  if (!isUuid(userId)) {
    // For guest IDs, just update in-memory without DB change
    const conversation = activeSessions.get(sessionId);
    if (conversation) {
      conversation.userId = userId;
    }
    console.log(`[Session] Skipping DB update for non-UUID userId: ${userId.substring(0, 20)}...`);
    return;
  }

  const pool = getPool();
  
  try {
    await pool.query(
      `UPDATE sessions
       SET user_id = $1,
           guest_id = NULL,
           group_id = (SELECT COALESCE(active_group_id, group_id) FROM users WHERE id = $1),
           updated_at = NOW()
       WHERE id = $2`,
      [userId, sessionId]
    );
  } catch (error: any) {
    // Backward compatibility: if group_id column doesn't exist yet, retry without it.
    if (error?.code === '42703') {
      await pool.query(
        'UPDATE sessions SET user_id = $1, guest_id = NULL, updated_at = NOW() WHERE id = $2',
        [userId, sessionId]
      );
    } else {
      throw error;
    }
  }
  
  // Update in-memory conversation if active
  const conversation = activeSessions.get(sessionId);
  if (conversation) {
    conversation.userId = userId;
  }
  
  console.log(`[Session] Updated session ${sessionId} userId to: ${userId}`);
}

/**
 * Get statistics about active sessions
 */
export function getActiveSessionsStats(): { count: number; sessions: string[] } {
  return {
    count: activeSessions.size,
    sessions: Array.from(activeSessions.keys())
  };
}

