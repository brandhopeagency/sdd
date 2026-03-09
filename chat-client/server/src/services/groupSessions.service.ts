import { getPool } from '../db';
import { getSessionConversationForAdmin } from './sessionModeration.service';
import type { StoredConversation } from '../types/conversation';

export interface GroupSessionListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'ended' | 'expired' | 'all';
  moderationStatus?: 'pending' | 'in_review' | 'moderated' | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export interface GroupSessionRow {
  id: string;
  userId: string | null;
  dialogflowSessionId: string;
  status: 'active' | 'ended' | 'expired';
  startedAt: Date;
  endedAt: Date | null;
  messageCount: number;
  languageCode: string;
  gcsPath: string | null;
  moderationStatus: 'pending' | 'in_review' | 'moderated';
  createdAt: Date;
  updatedAt: Date;
}

export async function listGroupSessions(groupId: string, params: GroupSessionListParams) {
  const pool = getPool();
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(Math.max(1, params.limit || 20), 100);
  const offset = (page - 1) * limit;

  const where: string[] = ['s.group_id = $1'];
  const values: any[] = [groupId];
  let i = 2;

  if (params.search) {
    const q = `%${params.search.trim()}%`;
    // Intentionally avoid PII-based searches here.
    where.push(`(s.id::text ILIKE $${i} OR s.dialogflow_session_id ILIKE $${i})`);
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
    const d = new Date(params.dateTo);
    if (!params.dateTo.includes('T')) {
      d.setHours(23, 59, 59, 999);
    }
    where.push(`s.started_at <= $${i}`);
    values.push(d);
    i++;
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM sessions s
      ${whereSql}
    `,
    values
  );
  const total = countResult.rows[0]?.total ?? 0;

  const listResult = await pool.query(
    `
      SELECT s.*
      FROM sessions s
      ${whereSql}
      ORDER BY s.started_at DESC
      LIMIT $${i} OFFSET $${i + 1}
    `,
    [...values, limit, offset]
  );

  const sessions: GroupSessionRow[] = listResult.rows.map((row: any) => ({
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

export async function getGroupSessionById(groupId: string, sessionId: string): Promise<GroupSessionRow | null> {
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM sessions WHERE id = $1 AND group_id = $2`, [sessionId, groupId]);
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getGroupSessionConversation(groupId: string, sessionId: string): Promise<StoredConversation | null> {
  // Enforce group boundary before fetching from GCS/DB
  const session = await getGroupSessionById(groupId, sessionId);
  if (!session) return null;
  return await getSessionConversationForAdmin(sessionId);
}

