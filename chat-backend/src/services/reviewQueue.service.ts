import { getPool } from '../db';
import { getAnonymousSessionId, generateAnonymousId } from './anonymization.service';
import type { QueueSession } from '@mentalhelpglobal/chat-types';
import { createNotification } from './reviewNotification.service';

// ── Row mapper ──

function rowToQueueSession(row: any): QueueSession {
  return {
    id: row.id,
    anonymousSessionId: getAnonymousSessionId(row.id),
    anonymousUserId: row.user_id
      ? generateAnonymousId(row.user_id, 'USER')
      : 'USER-ANON',
    messageCount: Number(row.message_count ?? 0),
    assistantMessageCount: Number(row.assistant_message_count ?? 0),
    reviewStatus: row.review_status ?? 'pending_review',
    reviewCount: Number(row.review_count ?? 0),
    reviewsRequired: Number(row.reviews_required ?? 3),
    riskLevel: row.risk_level ?? 'none',
    autoFlagged: Boolean(row.auto_flagged),
    language: row.language ?? null,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    myReviewStatus: row.my_review_status ?? null,
    assignedReviewerId: row.assigned_reviewer_id ?? null,
    assignedExpiresAt: row.assigned_expires_at ?? null,
  };
}

// ── Queue counts ──

export interface QueueCounts {
  pending: number;
  flagged: number;
  inProgress: number;
  completed: number;
}

/**
 * Return counts for each queue tab for the given reviewer.
 */
export async function getQueueCounts(reviewerId: string, groupId?: string): Promise<QueueCounts> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE s.review_status IN ('pending_review', 'in_review')
           AND s.review_count < s.reviews_required
           AND NOT EXISTS (
             SELECT 1 FROM session_exclusions se WHERE se.session_id = s.id
           )
       )::int AS pending,
       COUNT(*) FILTER (
         WHERE EXISTS (
           SELECT 1 FROM risk_flags rf
           WHERE rf.session_id = s.id AND rf.status IN ('open', 'investigating')
         )
       )::int AS flagged,
       COUNT(*) FILTER (
         WHERE EXISTS (
           SELECT 1 FROM session_reviews sr
           WHERE sr.session_id = s.id
             AND sr.reviewer_id = $1
             AND sr.status IN ('pending', 'in_progress')
         )
       )::int AS in_progress,
       COUNT(*) FILTER (
         WHERE s.review_status IN ('complete', 'disputed_closed')
       )::int AS completed
     FROM sessions s
     WHERE ($2::uuid IS NULL OR s.group_id = $2::uuid)`,
    [reviewerId, groupId ?? null],
  );

  const row = result.rows[0];
  return {
    pending: row?.pending ?? 0,
    flagged: row?.flagged ?? 0,
    inProgress: row?.in_progress ?? 0,
    completed: row?.completed ?? 0,
  };
}

export async function canAccessGroupScopedQueue(userId: string, groupId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT 1
     FROM group_memberships gm
     WHERE gm.user_id = $1
       AND gm.group_id = $2
       AND gm.status = 'active'
     LIMIT 1`,
    [userId, groupId],
  );

  return result.rows.length > 0;
}

// ── Service functions ──

/**
 * List sessions in the review queue with pagination, tab filtering,
 * multi-criteria filtering, priority sorting, and workload balancing.
 */
export async function listQueueSessions(params: {
  page?: number;
  pageSize?: number;
  tab?: string;
  language?: string;
  reviewerId?: string;
  riskLevel?: string;
  dateFrom?: string;
  dateTo?: string;
  assignedToMe?: boolean;
  sortBy?: string;
  excluded?: boolean;
  tags?: string;
  groupId?: string;
}): Promise<{ data: QueueSession[]; total: number; counts: QueueCounts }> {
  const pool = getPool();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const values: any[] = [];
  let i = 1;

  // Tab filter
  const tab = params.tab ?? 'pending';
  if (tab === 'pending') {
    where.push(`s.review_status IN ('pending_review', 'in_review')`);
    where.push(`s.review_count < s.reviews_required`);
  } else if (tab === 'flagged') {
    where.push(
      `EXISTS (
        SELECT 1 FROM risk_flags rf
        WHERE rf.session_id = s.id AND rf.status IN ('open', 'investigating')
      )`,
    );
  } else if (tab === 'in_progress') {
    // Sessions where the current reviewer has an active (pending/in_progress) review
    if (params.reviewerId) {
      where.push(
        `EXISTS (
          SELECT 1 FROM session_reviews sr
          WHERE sr.session_id = s.id
            AND sr.reviewer_id = $${i}
            AND sr.status IN ('pending', 'in_progress')
        )`,
      );
      values.push(params.reviewerId);
      i++;
    }
  } else if (tab === 'completed') {
    where.push(`s.review_status IN ('complete', 'disputed_closed')`);
  }

  // Workload balancing: for pending/flagged tabs exclude sessions already reviewed by current user
  if (params.reviewerId && (tab === 'pending' || tab === 'flagged')) {
    where.push(
      `NOT EXISTS (
        SELECT 1 FROM session_reviews sr
        WHERE sr.session_id = s.id
          AND sr.reviewer_id = $${i}
          AND sr.status NOT IN ('expired')
      )`,
    );
    values.push(params.reviewerId);
    i++;
  }

  // Workload balancing: exclude sessions that have reached max reviews
  if (tab === 'pending' || tab === 'flagged') {
    where.push(`s.review_count < s.reviews_required`);
  }

  // Risk level filter
  if (params.riskLevel) {
    where.push(`s.risk_level = $${i}`);
    values.push(params.riskLevel);
    i++;
  }

  // Language filter
  if (params.language) {
    where.push(`s.language = $${i}`);
    values.push(params.language);
    i++;
  }

  // Optional group scope
  if (params.groupId) {
    where.push(`s.group_id = $${i}::uuid`);
    values.push(params.groupId);
    i++;
  }

  // Date range filters
  if (params.dateFrom) {
    where.push(`s.started_at >= $${i}::timestamptz`);
    values.push(params.dateFrom);
    i++;
  }
  if (params.dateTo) {
    where.push(`s.started_at <= $${i}::timestamptz`);
    values.push(params.dateTo);
    i++;
  }

  // Exclusion filter: by default, hide excluded sessions; when excluded=true, show ONLY excluded
  if (params.excluded) {
    where.push(
      `EXISTS (
        SELECT 1 FROM session_exclusions se WHERE se.session_id = s.id
      )`,
    );
  } else {
    where.push(
      `NOT EXISTS (
        SELECT 1 FROM session_exclusions se WHERE se.session_id = s.id
      )`,
    );
  }

  // Tags filter: comma-separated tag names
  if (params.tags) {
    const tagNames = params.tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (tagNames.length > 0) {
      where.push(
        `EXISTS (
          SELECT 1 FROM session_tags st
          JOIN tag_definitions td ON td.id = st.tag_definition_id
          WHERE st.session_id = s.id
            AND td.name = ANY($${i}::text[])
        )`,
      );
      values.push(tagNames);
      i++;
    }
  }

  // Assigned to me filter
  if (params.assignedToMe && params.reviewerId) {
    where.push(
      `EXISTS (
        SELECT 1 FROM session_reviews sr
        WHERE sr.session_id = s.id
          AND sr.reviewer_id = $${i}
          AND sr.status IN ('pending', 'in_progress')
      )`,
    );
    values.push(params.reviewerId);
    i++;
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Build reviewer subquery for myReviewStatus and assignment info
  let myReviewSelect = 'NULL AS my_review_status, NULL AS assigned_reviewer_id, NULL AS assigned_expires_at';
  const joinClauses: string[] = [];

  if (params.reviewerId) {
    // Find the param index for reviewerId in the join — we need a new param slot
    const reviewerJoinIdx = i;
    values.push(params.reviewerId);
    i++;

    myReviewSelect = `my_review.status AS my_review_status, my_review.reviewer_id AS assigned_reviewer_id, my_review.expires_at AS assigned_expires_at`;
    joinClauses.push(
      `LEFT JOIN session_reviews my_review
         ON my_review.session_id = s.id AND my_review.reviewer_id = $${reviewerJoinIdx}`,
    );
  }

  const joinSql = joinClauses.join('\n');

  // Determine ORDER BY clause
  let orderSql: string;
  const sortBy = params.sortBy ?? 'priority';
  if (sortBy === 'oldest') {
    orderSql = 'ORDER BY s.started_at ASC';
  } else if (sortBy === 'newest') {
    orderSql = 'ORDER BY s.started_at DESC';
  } else {
    // Default 'priority': flagged/high risk first, then oldest
    orderSql = `ORDER BY
      CASE s.risk_level
        WHEN 'high' THEN 0
        WHEN 'medium' THEN 1
        WHEN 'low' THEN 2
        ELSE 3
      END ASC,
      CASE WHEN s.auto_flagged THEN 0 ELSE 1 END ASC,
      s.started_at ASC`;
  }

  // Fetch counts in parallel with the list query
  const countsPromise = params.reviewerId
    ? getQueueCounts(params.reviewerId, params.groupId)
    : Promise.resolve({ pending: 0, flagged: 0, inProgress: 0, completed: 0 });

  // Count total
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM sessions s
     ${joinSql}
     ${whereSql}`,
    values,
  );
  const total = countResult.rows[0]?.total ?? 0;

  // Count assistant messages per session via subquery
  const listResult = await pool.query(
    `SELECT
       s.id,
       s.user_id,
       s.message_count,
       (
         SELECT COUNT(*)::int FROM session_messages sm
        WHERE sm.session_id = s.id
          AND LOWER(TRIM(sm.role)) IN ('assistant', 'ai', 'bot', 'model', 'agent')
       ) AS assistant_message_count,
       s.review_status,
       s.review_count,
       s.reviews_required,
       s.risk_level,
       s.auto_flagged,
       s.language,
       s.started_at,
       s.ended_at,
       ${myReviewSelect}
     FROM sessions s
     ${joinSql}
     ${whereSql}
     ${orderSql}
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, pageSize, offset],
  );

  const data = listResult.rows.map((row: any) => rowToQueueSession(row));
  const counts = await countsPromise;

  // Populate tags and exclusions per session (for tag badge display and excluded view)
  const sessionIds = data.map((s) => s.id);
  if (sessionIds.length > 0) {
    const [tagsResult, exclusionsResult] = await Promise.all([
      pool.query(
        `SELECT st.session_id, st.id, st.tag_definition_id, st.source, st.applied_by, st.created_at,
                td.name AS tag_name, td.category AS tag_category
         FROM session_tags st
         JOIN tag_definitions td ON td.id = st.tag_definition_id
         WHERE st.session_id = ANY($1)`,
        [sessionIds],
      ),
      pool.query(
        `SELECT se.session_id, se.id, se.reason, se.reason_source, se.tag_definition_id, se.created_at
         FROM session_exclusions se
         WHERE se.session_id = ANY($1)`,
        [sessionIds],
      ),
    ]);

    const tagsBySession = new Map<string, any[]>();
    for (const row of tagsResult.rows) {
      const list = tagsBySession.get(row.session_id) || [];
      list.push({
        id: row.id,
        sessionId: row.session_id,
        tagDefinitionId: row.tag_definition_id,
        source: row.source,
        appliedBy: row.applied_by,
        createdAt: row.created_at,
        tagDefinition: { name: row.tag_name, category: row.tag_category },
      });
      tagsBySession.set(row.session_id, list);
    }

    const exclusionsBySession = new Map<string, any[]>();
    for (const row of exclusionsResult.rows) {
      const list = exclusionsBySession.get(row.session_id) || [];
      list.push({
        id: row.id,
        sessionId: row.session_id,
        reason: row.reason,
        reasonSource: row.reason_source,
        tagDefinitionId: row.tag_definition_id,
        createdAt: row.created_at,
      });
      exclusionsBySession.set(row.session_id, list);
    }

    for (const session of data) {
      session.tags = tagsBySession.get(session.id) || [];
      session.exclusions = exclusionsBySession.get(session.id) || [];
    }
  }

  return { data, total, counts };
}

// ── Assignment ──

/**
 * Assign a session to a reviewer by creating a pending review with 24h expiration.
 * Validates the reviewer hasn't already reviewed this session.
 */
export async function assignSession(
  sessionId: string,
  reviewerId: string,
  assignedBy: string,
): Promise<void> {
  const pool = getPool();

  // Validate reviewer hasn't already reviewed (or has an active review for) this session
  const existing = await pool.query(
    `SELECT id, status FROM session_reviews
     WHERE session_id = $1 AND reviewer_id = $2
       AND status NOT IN ('expired')`,
    [sessionId, reviewerId],
  );

  if (existing.rows.length > 0) {
    throw new Error('Reviewer already has an active or completed review for this session');
  }

  // Create a pending review with 24h expiration
  await pool.query(
    `INSERT INTO session_reviews (session_id, reviewer_id, status, expires_at)
     VALUES ($1, $2, 'pending', NOW() + INTERVAL '24 hours')`,
    [sessionId, reviewerId],
  );

  // Update session status to in_review if still pending
  await pool.query(
    `UPDATE sessions SET review_status = 'in_review'
     WHERE id = $1 AND review_status = 'pending_review'`,
    [sessionId],
  );

  // Insert audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      assignedBy,
      'session_assigned',
      'session',
      sessionId,
      JSON.stringify({ reviewerId, assignedBy }),
    ],
  );

  // Notify the assigned reviewer
  void createNotification({
    recipientId: reviewerId,
    eventType: 'review_assigned',
    title: 'New review assignment',
    body: 'A session has been assigned to you for review.',
    data: { sessionId, assignedBy },
  }).catch((e) => console.warn('[Notifications] Failed to notify reviewer:', e));
}

// ── Expiration ──

/**
 * Expire stale reviews that have passed their expiration time.
 * Returns the count of expired reviews.
 */
export async function expireStaleReviews(): Promise<number> {
  const pool = getPool();

  const result = await pool.query(
    `UPDATE session_reviews
     SET status = 'expired', updated_at = NOW()
     WHERE expires_at < NOW()
       AND status IN ('pending', 'in_progress')
     RETURNING id, session_id, reviewer_id`,
  );

  // Insert audit logs for each expired review
  for (const row of result.rows) {
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'system',
        'review_expired',
        'session_review',
        row.id,
        JSON.stringify({
          sessionId: row.session_id,
          reviewerId: row.reviewer_id,
        }),
      ],
    );
  }

  return result.rowCount ?? 0;
}

/** Alias for task compatibility — same as expireStaleReviews */
export const expireAssignments = expireStaleReviews;
