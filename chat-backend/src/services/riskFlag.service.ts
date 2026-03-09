import { getPool } from '../db';
import type { RiskFlag } from '../types/review.types';
import { createNotificationsForRole, sendHighRiskEmailAlert } from './reviewNotification.service';

// ── Severity ranking for MAX comparison ──

const SEVERITY_RANK: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function maxSeverity(a: string, b: string): string {
  return (SEVERITY_RANK[a] ?? 0) >= (SEVERITY_RANK[b] ?? 0) ? a : b;
}

// ── Row mapper ──

function rowToRiskFlag(row: any): RiskFlag {
  return {
    id: row.id,
    sessionId: row.session_id,
    flaggedBy: row.flagged_by ?? null,
    severity: row.severity,
    reasonCategory: row.reason_category,
    details: row.details,
    status: row.status,
    assignedModeratorId: row.assigned_moderator_id ?? null,
    resolutionNotes: row.resolution_notes ?? null,
    resolvedBy: row.resolved_by ?? null,
    resolvedAt: row.resolved_at ?? null,
    deanonymizationRequested: Boolean(row.deanonymization_requested),
    isAutoDetected: Boolean(row.is_auto_detected),
    matchedKeywords: row.matched_keywords ?? [],
    slaDeadline: row.sla_deadline ?? null,
    notificationDeliveryStatus: row.notification_delivery_status ?? 'pending',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Service functions ──

/**
 * Create a risk flag on a session.
 * - Inserts the flag with an SLA deadline based on severity
 * - Updates the session's risk_level to the MAX of existing and new severity
 * - Logs the action to audit_log
 */
export async function createFlag(input: {
  sessionId: string;
  flaggedBy: string | null;
  severity: string;
  reasonCategory: string;
  details: string;
  deanonymizationRequested?: boolean;
  isAutoDetected?: boolean;
  matchedKeywords?: string[];
}): Promise<RiskFlag> {
  const pool = getPool();

  // Load SLA config
  const configResult = await pool.query(
    'SELECT high_risk_sla_hours, medium_risk_sla_hours FROM review_configuration WHERE id = 1',
  );

  const config = configResult.rows[0] ?? {
    high_risk_sla_hours: 2,
    medium_risk_sla_hours: 24,
  };

  let slaHours: number;
  if (input.severity === 'high') {
    slaHours = Number(config.high_risk_sla_hours);
  } else if (input.severity === 'medium') {
    slaHours = Number(config.medium_risk_sla_hours);
  } else {
    // low severity — no strict SLA, use a generous default
    slaHours = 72;
  }

  // INSERT risk flag (notification_delivery_status starts as 'pending' per FR-026 resilience)
  const result = await pool.query(
    `INSERT INTO risk_flags (
      session_id, flagged_by, severity, reason_category, details,
      deanonymization_requested, is_auto_detected, matched_keywords,
      sla_deadline, notification_delivery_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + ($9 || ' hours')::INTERVAL, 'pending')
    RETURNING *`,
    [
      input.sessionId,
      input.flaggedBy,
      input.severity,
      input.reasonCategory,
      input.details,
      input.deanonymizationRequested ?? false,
      input.isAutoDetected ?? false,
      input.matchedKeywords ?? [],
      String(slaHours),
    ],
  );

  const flag = rowToRiskFlag(result.rows[0]);

  // UPDATE session risk_level = MAX(existing, new severity)
  const sessionResult = await pool.query(
    'SELECT risk_level FROM sessions WHERE id = $1',
    [input.sessionId],
  );

  if (sessionResult.rows.length > 0) {
    const currentLevel = sessionResult.rows[0].risk_level ?? 'none';
    const newLevel = maxSeverity(currentLevel, input.severity);

    await pool.query(
      'UPDATE sessions SET risk_level = $1 WHERE id = $2',
      [newLevel, input.sessionId],
    );
  }

  // INSERT audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.flaggedBy,
      'risk_flag_created',
      'session',
      input.sessionId,
      JSON.stringify({
        flagId: flag.id,
        severity: input.severity,
        reasonCategory: input.reasonCategory,
        isAutoDetected: input.isAutoDetected ?? false,
      }),
    ],
  );

  // FR-026: Send notifications with resilience tracking
  const notifData = { flagId: flag.id, sessionId: input.sessionId, severity: input.severity };
  let deliveryStatus: 'delivered' | 'pending' | 'failed' = 'delivered';

  if (input.severity === 'high') {
    try {
      await createNotificationsForRole(
        'moderator', 'high_risk_flag',
        'High-risk flag raised',
        `A high-risk flag (${input.reasonCategory}) has been raised on a session.`,
        notifData,
      );
      await createNotificationsForRole(
        'group_admin', 'high_risk_flag',
        'High-risk flag raised',
        `A high-risk flag (${input.reasonCategory}) has been raised on a session.`,
        notifData,
      );
      void sendHighRiskEmailAlert({ flagId: flag.id, sessionId: input.sessionId, reasonCategory: input.reasonCategory }).catch((e) =>
        console.warn('[Notifications] High-risk email alert failed:', e),
      );
    } catch (e) {
      console.warn('[Notifications] Delivery failed, marking as pending for retry:', e);
      deliveryStatus = 'pending';
    }
  } else if (input.severity === 'medium') {
    try {
      await createNotificationsForRole(
        'moderator', 'medium_risk_flag',
        'Medium-risk flag raised',
        `A medium-risk flag (${input.reasonCategory}) has been raised on a session.`,
        notifData,
      );
    } catch (e) {
      console.warn('[Notifications] Delivery failed, marking as pending for retry:', e);
      deliveryStatus = 'pending';
    }
  }
  // Low severity: no notifications needed, stays 'delivered'

  // Update notification delivery status on the flag
  if (deliveryStatus !== 'pending') {
    await pool.query(
      'UPDATE risk_flags SET notification_delivery_status = $1 WHERE id = $2',
      [deliveryStatus, flag.id],
    );
    flag.notificationDeliveryStatus = deliveryStatus;
  }

  return flag;
}

/**
 * FR-018: Auto-flag when an individual message score is ≤ 2.
 * FR-025: Auto-flag when a review average score is ≤ autoFlagThreshold.
 *
 * Avoids duplicate auto-flags for the same session and trigger type.
 */
export async function checkScoreAutoFlag(
  sessionId: string,
  score: number,
  trigger: 'low_score' | 'below_threshold',
): Promise<void> {
  const pool = getPool();

  // Determine details prefix to detect duplicate auto-flags
  const detailsPrefix = trigger === 'low_score'
    ? 'Auto-flagged: Message received a score'
    : 'Auto-flagged: Review average score';

  const existing = await pool.query(
    `SELECT id FROM risk_flags
     WHERE session_id = $1 AND is_auto_detected = true AND details LIKE $2`,
    [sessionId, `${detailsPrefix}%`],
  );

  if (existing.rows.length > 0) return; // Already auto-flagged for this trigger

  const severity = score <= 2 ? 'high' : 'medium';

  await createFlag({
    sessionId,
    flaggedBy: null,
    severity,
    reasonCategory: 'other_safety_concern',
    details: trigger === 'low_score'
      ? `Auto-flagged: Message received a score of ${score} (≤ 2), indicating potential safety concerns.`
      : `Auto-flagged: Review average score of ${score} is at or below the auto-flag threshold.`,
    deanonymizationRequested: false,
    isAutoDetected: true,
  });
}

/**
 * List all risk flags for a given session, newest first.
 */
export async function listFlagsForSession(sessionId: string): Promise<RiskFlag[]> {
  const pool = getPool();

  const result = await pool.query(
    'SELECT * FROM risk_flags WHERE session_id = $1 ORDER BY created_at DESC',
    [sessionId],
  );

  return result.rows.map(rowToRiskFlag);
}

/**
 * Resolve, acknowledge, or escalate a flag.
 * Updates the flag status and records resolution metadata.
 */
export async function resolveFlag(
  flagId: string,
  resolvedBy: string,
  input: { resolutionNotes: string; newStatus: string },
): Promise<RiskFlag> {
  const pool = getPool();

  const result = await pool.query(
    `UPDATE risk_flags
     SET status = $1,
         resolution_notes = $2,
         resolved_by = $3,
         resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
     WHERE id = $4
     RETURNING *`,
    [input.newStatus, input.resolutionNotes, resolvedBy, flagId],
  );

  if (result.rows.length === 0) {
    const error: any = new Error('Risk flag not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const flag = rowToRiskFlag(result.rows[0]);

  // INSERT audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      resolvedBy,
      'risk_flag_resolved',
      'risk_flag',
      flagId,
      JSON.stringify({
        newStatus: input.newStatus,
        sessionId: flag.sessionId,
        severity: flag.severity,
      }),
    ],
  );

  return flag;
}

/**
 * List flags for the escalation queue with optional filters and pagination.
 * Returns flag data along with aggregate counts for dashboard badges.
 */
export async function listEscalations(params: {
  page?: number;
  pageSize?: number;
  severity?: string;
  status?: string;
}): Promise<{
  data: RiskFlag[];
  total: number;
  highOpen: number;
  mediumOpen: number;
  overdueSla: number;
}> {
  const pool = getPool();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Build WHERE clauses
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (params.severity) {
    conditions.push(`severity = $${paramIdx++}`);
    values.push(params.severity);
  }

  if (params.status) {
    conditions.push(`status = $${paramIdx++}`);
    values.push(params.status);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // Count total matching
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM risk_flags ${whereClause}`,
    values,
  );
  const total = countResult.rows[0]?.total ?? 0;

  // Fetch page of flags
  const dataResult = await pool.query(
    `SELECT * FROM risk_flags ${whereClause}
     ORDER BY
       CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...values, pageSize, offset],
  );

  // Aggregate counts (unfiltered — for dashboard badges)
  const countsResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE severity = 'high' AND status IN ('open', 'acknowledged'))::int AS high_open,
       COUNT(*) FILTER (WHERE severity = 'medium' AND status IN ('open', 'acknowledged'))::int AS medium_open,
       COUNT(*) FILTER (WHERE sla_deadline < NOW() AND status IN ('open', 'acknowledged'))::int AS overdue_sla
     FROM risk_flags`,
  );

  const counts = countsResult.rows[0] ?? {};

  return {
    data: dataResult.rows.map(rowToRiskFlag),
    total,
    highOpen: counts.high_open ?? 0,
    mediumOpen: counts.medium_open ?? 0,
    overdueSla: counts.overdue_sla ?? 0,
  };
}
