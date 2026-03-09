import { getPool } from '../db';
import { getConfig } from './reviewConfig.service';
import type {
  DeanonymizationRequest,
  RevealedIdentity,
} from '@mentalhelpglobal/chat-types';
import { createNotification, createNotificationsForRole } from './reviewNotification.service';

// ── Row mapper ──

function rowToRequest(row: any): DeanonymizationRequest {
  return {
    id: row.id,
    sessionId: row.session_id,
    targetUserId: row.target_user_id,
    requesterId: row.requester_id,
    approverId: row.approver_id ?? null,
    riskFlagId: row.risk_flag_id ?? null,
    justificationCategory: row.justification_category,
    justificationDetails: row.justification_details,
    status: row.status,
    denialNotes: row.denial_notes ?? null,
    accessExpiresAt: row.access_expires_at ?? null,
    accessedAt: row.accessed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Service functions ──

/**
 * Create a new deanonymization request.
 * Inserts the request with status 'pending' and logs the action.
 */
export async function createRequest(input: {
  sessionId: string;
  targetUserId: string;
  requesterId: string;
  riskFlagId?: string | null;
  justificationCategory: string;
  justificationDetails: string;
}): Promise<DeanonymizationRequest> {
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO deanonymization_requests
       (session_id, target_user_id, requester_id, risk_flag_id,
        justification_category, justification_details, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING *`,
    [
      input.sessionId,
      input.targetUserId,
      input.requesterId,
      input.riskFlagId ?? null,
      input.justificationCategory,
      input.justificationDetails,
    ],
  );

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.requesterId,
      'deanonymization_requested',
      'deanonymization_request',
      result.rows[0].id,
      JSON.stringify({
        sessionId: input.sessionId,
        justificationCategory: input.justificationCategory,
        riskFlagId: input.riskFlagId ?? null,
      }),
    ],
  );

  const request = rowToRequest(result.rows[0]);

  // Notify group admins (commanders) of new deanonymization request
  void createNotificationsForRole(
    'group_admin',
    'deanonymization_requested',
    'New deanonymization request',
    'A deanonymization request has been submitted and requires approval.',
    { requestId: request.id, sessionId: input.sessionId },
  ).catch((e) => console.warn('[Notifications] Failed to notify group admins of deanonymization request:', e));

  return request;
}

/**
 * List deanonymization requests with optional filters and pagination.
 */
export async function listRequests(params: {
  status?: string;
  requesterId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: DeanonymizationRequest[]; total: number }> {
  const pool = getPool();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (params.status) {
    conditions.push(`status = $${paramIdx++}`);
    values.push(params.status);
  }

  if (params.requesterId) {
    conditions.push(`requester_id = $${paramIdx++}`);
    values.push(params.requesterId);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // Count
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM deanonymization_requests ${whereClause}`,
    values,
  );
  const total = countResult.rows[0]?.total ?? 0;

  // Data
  const dataResult = await pool.query(
    `SELECT * FROM deanonymization_requests ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...values, pageSize, offset],
  );

  return {
    data: dataResult.rows.map(rowToRequest),
    total,
  };
}

/**
 * Approve a deanonymization request.
 * Sets status to 'approved', assigns approver, and computes access expiry.
 */
export async function approveRequest(
  requestId: string,
  approverId: string,
  accessDurationHours?: number,
): Promise<DeanonymizationRequest> {
  const pool = getPool();

  // Determine access duration from param or config
  let durationHours = accessDurationHours;
  if (!durationHours) {
    const config = await getConfig();
    durationHours = config.deanonymizationAccessHours ?? 72;
  }

  const result = await pool.query(
    `UPDATE deanonymization_requests
     SET status = 'approved',
         approver_id = $1,
         access_expires_at = NOW() + ($2 || ' hours')::INTERVAL,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [approverId, String(durationHours), requestId],
  );

  if (result.rows.length === 0) {
    const error: any = new Error('Deanonymization request not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      approverId,
      'deanonymization_approved',
      'deanonymization_request',
      requestId,
      JSON.stringify({
        accessDurationHours: durationHours,
        sessionId: result.rows[0].session_id,
      }),
    ],
  );

  // Notify the requester about approval
  const approved = rowToRequest(result.rows[0]);
  void createNotification({
    recipientId: approved.requesterId,
    eventType: 'deanonymization_resolved',
    title: 'Deanonymization Request Approved',
    body: 'Your deanonymization request has been approved. You may now access the revealed identity.',
    data: { requestId, sessionId: approved.sessionId },
  }).catch((e) => console.warn('[Notifications] Failed to notify requester of approval:', e));

  return approved;
}

/**
 * Deny a deanonymization request.
 * Sets status to 'denied' with approver and denial notes.
 */
export async function denyRequest(
  requestId: string,
  approverId: string,
  denialNotes: string,
): Promise<DeanonymizationRequest> {
  const pool = getPool();

  const result = await pool.query(
    `UPDATE deanonymization_requests
     SET status = 'denied',
         approver_id = $1,
         denial_notes = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [approverId, denialNotes, requestId],
  );

  if (result.rows.length === 0) {
    const error: any = new Error('Deanonymization request not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      approverId,
      'deanonymization_denied',
      'deanonymization_request',
      requestId,
      JSON.stringify({
        denialNotes,
        sessionId: result.rows[0].session_id,
      }),
    ],
  );

  // Notify the requester about denial
  const denied = rowToRequest(result.rows[0]);
  void createNotification({
    recipientId: denied.requesterId,
    eventType: 'deanonymization_resolved',
    title: 'Deanonymization Request Denied',
    body: `Your deanonymization request has been denied. Reason: ${denialNotes}`,
    data: { requestId, sessionId: denied.sessionId },
  }).catch((e) => console.warn('[Notifications] Failed to notify requester of denial:', e));

  return denied;
}

/**
 * Get the revealed identity for an approved deanonymization request.
 * Verifies the request is approved and access has not expired.
 * Records the access timestamp and audit log on first access.
 */
export async function getRevealedIdentity(
  requestId: string,
  accessorId: string,
): Promise<RevealedIdentity | null> {
  const pool = getPool();

  // Get the request
  const reqResult = await pool.query(
    'SELECT * FROM deanonymization_requests WHERE id = $1',
    [requestId],
  );

  if (reqResult.rows.length === 0) {
    const error: any = new Error('Deanonymization request not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const row = reqResult.rows[0];

  // Verify status is approved
  if (row.status !== 'approved') {
    return null;
  }

  // Check access expiry
  if (row.access_expires_at && new Date(row.access_expires_at) < new Date()) {
    // Log expiration event
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        accessorId,
        'identity_access_expired',
        'deanonymization_request',
        requestId,
        JSON.stringify({
          targetUserId: row.target_user_id,
          sessionId: row.session_id,
          accessExpiresAt: row.access_expires_at,
        }),
      ],
    );
    return null;
  }

  // Get real user info
  const userResult = await pool.query(
    'SELECT id, email, display_name FROM users WHERE id = $1',
    [row.target_user_id],
  );

  if (userResult.rows.length === 0) {
    const error: any = new Error('Target user not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const user = userResult.rows[0];

  // Record first access timestamp
  if (!row.accessed_at) {
    await pool.query(
      `UPDATE deanonymization_requests SET accessed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [requestId],
    );
  }

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      accessorId,
      'identity_accessed',
      'deanonymization_request',
      requestId,
      JSON.stringify({
        targetUserId: row.target_user_id,
        sessionId: row.session_id,
      }),
    ],
  );

  return {
    requestId,
    realUserId: user.id,
    email: user.email,
    displayName: user.display_name,
    accessExpiresAt: row.access_expires_at,
  };
}

/**
 * Expire approved deanonymization requests whose access window has passed.
 * Returns the count of expired requests.
 */
export async function expireAccess(): Promise<number> {
  const pool = getPool();

  // Find requests to expire
  const toExpire = await pool.query(
    `SELECT id, requester_id, session_id
     FROM deanonymization_requests
     WHERE status = 'approved'
       AND access_expires_at IS NOT NULL
       AND access_expires_at < NOW()`,
  );

  if (toExpire.rows.length === 0) {
    return 0;
  }

  const ids = toExpire.rows.map((r: any) => r.id);

  // Bulk update status
  await pool.query(
    `UPDATE deanonymization_requests
     SET status = 'expired', updated_at = NOW()
     WHERE id = ANY($1)`,
    [ids],
  );

  // Insert audit logs for each expired request
  for (const row of toExpire.rows) {
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'system',
        'deanonymization_expired',
        'deanonymization_request',
        row.id,
        JSON.stringify({
          sessionId: row.session_id,
          requesterId: row.requester_id,
        }),
      ],
    );
  }

  return toExpire.rows.length;
}
