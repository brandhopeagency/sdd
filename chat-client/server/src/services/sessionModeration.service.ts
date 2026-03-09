import { getPool } from '../db';
import { getConversation } from './gcs.service';
import type { StoredConversation, StoredMessage } from '../types/conversation';

export type ModerationStatus = 'pending' | 'in_review' | 'moderated';

export interface ListSessionsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'ended' | 'expired' | 'all';
  moderationStatus?: ModerationStatus | 'all';
  dateFrom?: string; // ISO date
  dateTo?: string;   // ISO date
}

export interface AdminSession {
  id: string;
  userId: string | null;
  dialogflowSessionId: string;
  status: 'active' | 'ended' | 'expired';
  startedAt: Date;
  endedAt: Date | null;
  messageCount: number;
  languageCode: string;
  gcsPath: string | null;
  moderationStatus: ModerationStatus;
  tags: string[];
  userName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getAdminSessionsStats(): Promise<{
  total: number;
  byStatus: { active: number; ended: number; expired: number };
  byModerationStatus: { pending: number; in_review: number; moderated: number };
}> {
  const pool = getPool();

  const [totalResult, byStatusResult, byModerationResult] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM sessions`),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'ended')::int AS ended,
        COUNT(*) FILTER (WHERE status = 'expired')::int AS expired
      FROM sessions
    `),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE moderation_status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE moderation_status = 'in_review')::int AS in_review,
        COUNT(*) FILTER (WHERE moderation_status = 'moderated')::int AS moderated
      FROM sessions
    `)
  ]);

  return {
    total: totalResult.rows[0]?.total ?? 0,
    byStatus: byStatusResult.rows[0],
    byModerationStatus: byModerationResult.rows[0]
  };
}

function normalizeTagName(tagName: string): string {
  return tagName.trim().replace(/\s+/g, ' ');
}

export async function listAdminSessions(
  params: ListSessionsParams,
  options?: { includePiiSearch?: boolean }
) {
  const pool = getPool();
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(Math.max(1, params.limit || 20), 100);
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const values: any[] = [];
  let i = 1;
  const includePiiSearch = options?.includePiiSearch ?? true;

  if (params.search) {
    const q = `%${params.search.trim()}%`;
    where.push(
      includePiiSearch
        ? `(s.id::text ILIKE $${i} OR u.display_name ILIKE $${i} OR u.email ILIKE $${i})`
        : `(s.id::text ILIKE $${i} OR s.user_id::text ILIKE $${i} OR s.dialogflow_session_id ILIKE $${i})`
    );
    values.push(q);
    i++;
  }

  if (params.status && params.status !== 'all') {
    where.push(`s.status = $${i}`);
    values.push(params.status);
    i++;
  }

  if (params.moderationStatus && params.moderationStatus !== 'all') {
    where.push(`s.moderation_status = $${i}`);
    values.push(params.moderationStatus);
    i++;
  }

  if (params.dateFrom) {
    where.push(`s.started_at >= $${i}`);
    values.push(new Date(params.dateFrom));
    i++;
  }

  if (params.dateTo) {
    // Inclusive end of day if date-only passed
    const d = new Date(params.dateTo);
    if (!params.dateTo.includes('T')) {
      d.setHours(23, 59, 59, 999);
    }
    where.push(`s.started_at <= $${i}`);
    values.push(d);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM sessions s
      LEFT JOIN users u ON u.id = s.user_id
      ${whereSql}
    `,
    values
  );
  const total = countResult.rows[0]?.total ?? 0;

  const listResult = await pool.query(
    `
      SELECT
        s.*,
        u.display_name AS user_name,
        COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) AS tags
      FROM sessions s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN session_tags st ON st.session_id = s.id
      LEFT JOIN tags t ON t.id = st.tag_id
      ${whereSql}
      GROUP BY s.id, u.display_name
      ORDER BY s.started_at DESC
      LIMIT $${i} OFFSET $${i + 1}
    `,
    [...values, limit, offset]
  );

  const sessions: AdminSession[] = listResult.rows.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    dialogflowSessionId: row.dialogflow_session_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    messageCount: row.message_count,
    languageCode: row.language_code,
    gcsPath: row.gcs_path,
    moderationStatus: row.moderation_status || 'pending',
    tags: Array.isArray(row.tags) ? row.tags : [],
    userName: row.user_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));

  return {
    page,
    limit,
    total,
    hasMore: offset + sessions.length < total,
    sessions
  };
}

export async function getAdminSessionById(sessionId: string): Promise<AdminSession | null> {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        s.*,
        u.display_name AS user_name,
        COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}'::text[]) AS tags
      FROM sessions s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN session_tags st ON st.session_id = s.id
      LEFT JOIN tags t ON t.id = st.tag_id
      WHERE s.id = $1
      GROUP BY s.id, u.display_name
    `,
    [sessionId]
  );

  if (result.rows.length === 0) return null;
  const row: any = result.rows[0];

  return {
    id: row.id,
    userId: row.user_id,
    dialogflowSessionId: row.dialogflow_session_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    messageCount: row.message_count,
    languageCode: row.language_code,
    gcsPath: row.gcs_path,
    moderationStatus: row.moderation_status || 'pending',
    tags: Array.isArray(row.tags) ? row.tags : [],
    userName: row.user_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getSessionConversationForAdmin(sessionId: string): Promise<StoredConversation | null> {
  const pool = getPool();

  const sessionResult = await pool.query(`SELECT * FROM sessions WHERE id = $1`, [sessionId]);
  if (sessionResult.rows.length === 0) return null;

  const session = sessionResult.rows[0] as any;

  if (session.gcs_path) {
    return await getConversation(session.gcs_path);
  }

  // Active / not yet saved to GCS: read from DB messages
  const messagesResult = await pool.query(
    `SELECT * FROM session_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );

  const messages: StoredMessage[] = messagesResult.rows.map((row: any) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    intent: row.intent_info ? (typeof row.intent_info === 'string' ? JSON.parse(row.intent_info) : row.intent_info) : undefined,
    match: row.match_info ? (typeof row.match_info === 'string' ? JSON.parse(row.match_info) : row.match_info) : undefined,
    generativeInfo: row.generative_info ? (typeof row.generative_info === 'string' ? JSON.parse(row.generative_info) : row.generative_info) : undefined,
    webhookStatuses: row.webhook_statuses ? (typeof row.webhook_statuses === 'string' ? JSON.parse(row.webhook_statuses) : row.webhook_statuses) : undefined,
    diagnosticInfo: row.diagnostic_info ? (typeof row.diagnostic_info === 'string' ? JSON.parse(row.diagnostic_info) : row.diagnostic_info) : undefined,
    sentiment: row.sentiment ? (typeof row.sentiment === 'string' ? JSON.parse(row.sentiment) : row.sentiment) : undefined,
    flowInfo: row.flow_info ? (typeof row.flow_info === 'string' ? JSON.parse(row.flow_info) : row.flow_info) : undefined,
    responseTimeMs: row.response_time_ms || undefined,
    feedback: row.feedback ? (typeof row.feedback === 'string' ? JSON.parse(row.feedback) : row.feedback) : undefined
  }));

  return {
    sessionId,
    userId: session.user_id,
    startedAt: (session.started_at as Date).toISOString(),
    endedAt: session.ended_at ? (session.ended_at as Date).toISOString() : '',
    status: session.status,
    messages,
    metadata: {
      messageCount: messages.length,
      languageCode: session.language_code,
      dialogflowSessionId: session.dialogflow_session_id,
      environment: process.env.NODE_ENV || 'development'
    }
  };
}

export async function updateSessionModerationStatus(
  sessionId: string,
  moderationStatus: ModerationStatus
): Promise<AdminSession | null> {
  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE sessions
      SET moderation_status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
    [moderationStatus, sessionId]
  );
  if (result.rows.length === 0) return null;
  return await getAdminSessionById(sessionId);
}

export async function listTags(category?: 'session' | 'message') {
  const pool = getPool();
  const result = await pool.query(
    `
      SELECT *
      FROM tags
      ${category ? 'WHERE category = $1' : ''}
      ORDER BY usage_count DESC, name ASC
    `,
    category ? [category] : []
  );
  return result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    color: row.color,
    description: row.description,
    isCustom: row.is_custom,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function getOrCreateTagId(tagName: string, category: 'session' | 'message', isCustom: boolean) {
  const pool = getPool();
  const name = normalizeTagName(tagName);

  const existing = await pool.query(
    `SELECT id FROM tags WHERE name = $1 AND category = $2`,
    [name, category]
  );
  if (existing.rows.length > 0) return existing.rows[0].id as string;

  const created = await pool.query(
    `
      INSERT INTO tags (name, category, is_custom)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [name, category, isCustom]
  );
  return created.rows[0].id as string;
}

export async function addSessionTag(sessionId: string, tagName: string, actorId: string | null) {
  const pool = getPool();
  const tagId = await getOrCreateTagId(tagName, 'session', true);

  await pool.query(
    `
      WITH ins AS (
        INSERT INTO session_tags (session_id, tag_id, added_by)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        RETURNING 1
      )
      UPDATE tags
      SET usage_count = usage_count + (SELECT COUNT(*) FROM ins)
      WHERE id = $2
    `,
    [sessionId, tagId, actorId]
  );

  return await getAdminSessionById(sessionId);
}

export async function removeSessionTag(sessionId: string, tagName: string) {
  const pool = getPool();
  const name = normalizeTagName(tagName);

  // Find tag
  const tagResult = await pool.query(`SELECT id FROM tags WHERE name = $1 AND category = 'session'`, [name]);
  if (tagResult.rows.length === 0) return await getAdminSessionById(sessionId);
  const tagId = tagResult.rows[0].id as string;

  await pool.query(
    `
      WITH del AS (
        DELETE FROM session_tags
        WHERE session_id = $1 AND tag_id = $2
        RETURNING 1
      )
      UPDATE tags
      SET usage_count = GREATEST(usage_count - (SELECT COUNT(*) FROM del), 0)
      WHERE id = $2
    `,
    [sessionId, tagId]
  );

  return await getAdminSessionById(sessionId);
}

export async function listSessionAnnotations(sessionId: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM annotations WHERE session_id = $1 ORDER BY created_at DESC`,
    [sessionId]
  );
  return result.rows.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    messageId: row.message_id,
    authorId: row.author_id,
    qualityRating: row.quality_rating,
    goldenReference: row.golden_reference,
    notes: row.notes,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function createSessionAnnotation(input: {
  sessionId: string;
  messageId?: string | null;
  authorId: string | null;
  qualityRating: 1 | 2 | 3 | 4 | 5;
  goldenReference?: string | null;
  notes?: string;
  tags?: string[];
}) {
  const pool = getPool();

  const result = await pool.query(
    `
      INSERT INTO annotations (
        session_id, message_id, author_id, quality_rating, golden_reference, notes, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      input.sessionId,
      input.messageId || null,
      input.authorId,
      input.qualityRating,
      input.goldenReference || null,
      input.notes || '',
      input.tags || []
    ]
  );

  const row: any = result.rows[0];
  return {
    id: row.id,
    sessionId: row.session_id,
    messageId: row.message_id,
    authorId: row.author_id,
    qualityRating: row.quality_rating,
    goldenReference: row.golden_reference,
    notes: row.notes,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

