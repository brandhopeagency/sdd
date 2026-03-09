import { getPool } from '../db';
import { sendEmail } from './email';
import type { ReviewNotification, BannerAlerts } from '@mentalhelpglobal/chat-types';

// ── Row mapper ──

function rowToNotification(row: any): ReviewNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    eventType: row.event_type,
    title: row.title,
    body: row.body,
    data: row.data ?? null,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

// ── Service functions ──

/**
 * Create a single notification for a specific recipient.
 */
export async function createNotification(input: {
  recipientId: string;
  eventType: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<ReviewNotification> {
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO review_notifications (recipient_id, event_type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.recipientId,
      input.eventType,
      input.title,
      input.body,
      input.data ? JSON.stringify(input.data) : null,
    ],
  );

  return rowToNotification(result.rows[0]);
}

/**
 * Send email alert for high-risk flags to moderators and group admins.
 */
export async function sendHighRiskEmailAlert(input: {
  flagId: string;
  sessionId: string;
  reasonCategory: string;
}): Promise<void> {
  const pool = getPool();
  const adminsResult = await pool.query(
    `SELECT email FROM users WHERE role IN ('moderator', 'group_admin') AND email IS NOT NULL`,
  );
  const subject = `[URGENT] High-risk flag raised`;
  const body = `A high-risk flag (${input.reasonCategory}) has been raised on session ${input.sessionId}. Please check the escalation queue.`;
  for (const admin of adminsResult.rows) {
    try {
      await sendEmail({ to: admin.email, subject, text: body });
    } catch (e) {
      console.warn(`[Notifications] High-risk email failed for ${admin.email}:`, e);
    }
  }
}

/**
 * Create notifications for all users with a given role.
 */
export async function createNotificationsForRole(
  role: string,
  eventType: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const pool = getPool();

  const usersResult = await pool.query(
    'SELECT id FROM users WHERE role = $1',
    [role],
  );

  for (const row of usersResult.rows) {
    await createNotification({
      recipientId: row.id,
      eventType,
      title,
      body,
      data,
    });
  }
}

/**
 * Get notifications for a recipient with optional unread-only filter and pagination.
 */
export async function getNotifications(
  recipientId: string,
  params: { unreadOnly?: boolean; page?: number; pageSize?: number },
): Promise<{ data: ReviewNotification[]; total: number; unreadCount: number }> {
  const pool = getPool();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Build WHERE clause
  const conditions: string[] = ['recipient_id = $1'];
  const values: unknown[] = [recipientId];
  let paramIdx = 2;

  if (params.unreadOnly) {
    conditions.push('read_at IS NULL');
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Count total matching
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM review_notifications ${whereClause}`,
    values,
  );
  const total = countResult.rows[0]?.total ?? 0;

  // Get unread count (always unfiltered by unreadOnly)
  const unreadResult = await pool.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM review_notifications
     WHERE recipient_id = $1 AND read_at IS NULL`,
    [recipientId],
  );
  const unreadCount = unreadResult.rows[0]?.unread_count ?? 0;

  // Fetch page
  const dataResult = await pool.query(
    `SELECT * FROM review_notifications ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...values, pageSize, offset],
  );

  return {
    data: dataResult.rows.map(rowToNotification),
    total,
    unreadCount,
  };
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(
  notificationId: string,
  recipientId: string,
): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE review_notifications SET read_at = NOW()
     WHERE id = $1 AND recipient_id = $2`,
    [notificationId, recipientId],
  );
}

/**
 * Mark all unread notifications as read for a recipient.
 */
export async function markAllAsRead(recipientId: string): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE review_notifications SET read_at = NOW()
     WHERE recipient_id = $1 AND read_at IS NULL`,
    [recipientId],
  );
}

// ── FR-026 Resilience: Notification retry polling ──

const RETRY_INTERVAL_MS = 60_000; // 60 seconds
const EMAIL_FALLBACK_MINUTES = 15;
const ASSIGNMENT_EXPIRY_WINDOW_HOURS = 4;
let retryTimerId: ReturnType<typeof setInterval> | null = null;

// Track which reviewers we've already notified for expiring assignments (avoid spam)
const assignmentExpiryNotified = new Set<string>();

/**
 * Check for reviews expiring within 4 hours and create assignment_expiring notifications.
 */
export async function checkAssignmentExpiryReminders(): Promise<void> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT sr.id, sr.session_id, sr.reviewer_id, sr.expires_at
       FROM session_reviews sr
       WHERE sr.status IN ('pending', 'in_progress')
         AND sr.expires_at IS NOT NULL
         AND sr.expires_at > NOW()
         AND sr.expires_at <= NOW() + ($1 || ' hours')::INTERVAL`,
      [String(ASSIGNMENT_EXPIRY_WINDOW_HOURS)],
    );

    for (const row of result.rows) {
      const key = `${row.session_id}:${row.reviewer_id}`;
      if (assignmentExpiryNotified.has(key)) continue;

      const expiresAt = new Date(row.expires_at);
      const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / 3600_000);

      await createNotification({
        recipientId: row.reviewer_id,
        eventType: 'assignment_expiring',
        title: 'Review assignment expiring soon',
        body: `Your review assignment for session ${row.session_id} expires in about ${hoursLeft} hour(s).`,
        data: { sessionId: row.session_id, reviewId: row.id, expiresAt: row.expires_at },
      });

      assignmentExpiryNotified.add(key);
    }

    // Clean up keys for expired assignments
    for (const key of assignmentExpiryNotified) {
      const [sessionId, reviewerId] = key.split(':');
      const exists = await pool.query(
        `SELECT 1 FROM session_reviews
         WHERE session_id = $1 AND reviewer_id = $2 AND status IN ('pending', 'in_progress')`,
        [sessionId, reviewerId],
      );
      if (exists.rows.length === 0) {
        assignmentExpiryNotified.delete(key);
      }
    }
  } catch (e) {
    console.error('[Notifications] Error in assignment expiry check:', e);
  }
}

/**
 * Retry delivery for risk flags with notification_delivery_status = 'pending'.
 * Flags older than 15 minutes escalate to email fallback.
 */
export async function retryPendingNotifications(): Promise<void> {
  const pool = getPool();

  try {
    // Find flags with pending notifications
    const pendingResult = await pool.query(
      `SELECT rf.id, rf.session_id, rf.severity, rf.reason_category, rf.created_at
       FROM risk_flags rf
       WHERE rf.notification_delivery_status = 'pending'
       ORDER BY rf.created_at ASC`,
    );

    for (const row of pendingResult.rows) {
      const ageMinutes = (Date.now() - new Date(row.created_at).getTime()) / 60_000;

      if (ageMinutes >= EMAIL_FALLBACK_MINUTES) {
        // Escalate to email fallback after 15 minutes
        console.warn(
          `[Notifications] Flag ${row.id} pending for >${EMAIL_FALLBACK_MINUTES}m — escalating to email fallback`,
        );

        // Attempt email notification to all admins
        const adminsResult = await pool.query(
          `SELECT id, email FROM users WHERE role IN ('moderator', 'group_admin') AND email IS NOT NULL`,
        );

        const subject = `[URGENT] ${row.severity}-risk flag requires attention`;
        const body = `Risk flag (${row.reason_category}) on session ${row.session_id} has not been delivered for ${Math.round(ageMinutes)} minutes. Please check the escalation queue.`;

        for (const admin of adminsResult.rows) {
          await createNotification({
            recipientId: admin.id,
            eventType: 'high_risk_flag',
            title: `[EMAIL FALLBACK] ${row.severity}-risk flag requires attention`,
            body: `Risk flag (${row.reason_category}) on session ${row.session_id} has not been delivered for ${Math.round(ageMinutes)} minutes. Email fallback triggered.`,
            data: { flagId: row.id, sessionId: row.session_id, emailFallback: true },
          });
          try {
            await sendEmail({ to: admin.email, subject, text: body });
          } catch (e) {
            console.warn(`[Notifications] Email fallback failed for ${admin.email}:`, e);
          }
        }

        // Mark as failed after email fallback attempt
        await pool.query(
          `UPDATE risk_flags SET notification_delivery_status = 'failed' WHERE id = $1`,
          [row.id],
        );
      } else {
        // Retry in-app notification delivery
        const notifData = { flagId: row.id, sessionId: row.session_id, severity: row.severity };

        try {
          if (row.severity === 'high') {
            await createNotificationsForRole(
              'moderator', 'high_risk_flag',
              'High-risk flag raised',
              `A high-risk flag (${row.reason_category}) has been raised on a session.`,
              notifData,
            );
            await createNotificationsForRole(
              'group_admin', 'high_risk_flag',
              'High-risk flag raised',
              `A high-risk flag (${row.reason_category}) has been raised on a session.`,
              notifData,
            );
          } else if (row.severity === 'medium') {
            await createNotificationsForRole(
              'moderator', 'medium_risk_flag',
              'Medium-risk flag raised',
              `A medium-risk flag (${row.reason_category}) has been raised on a session.`,
              notifData,
            );
          }

          // Mark as delivered on success
          await pool.query(
            `UPDATE risk_flags SET notification_delivery_status = 'delivered' WHERE id = $1`,
            [row.id],
          );
        } catch (e) {
          console.warn(`[Notifications] Retry failed for flag ${row.id}:`, e);
          // Stays 'pending' — will be retried next cycle
        }
      }
    }
  } catch (e) {
    console.error('[Notifications] Error in retry polling:', e);
  }
}

/**
 * Combined notification maintenance: retry pending + assignment expiry reminders.
 */
async function runNotificationMaintenance(): Promise<void> {
  await retryPendingNotifications();
  await checkAssignmentExpiryReminders();
}

/**
 * Start the scheduled retry polling loop (every 60 seconds).
 * Safe to call multiple times — only one timer will run.
 */
export function startNotificationRetryPolling(): void {
  if (retryTimerId) return;
  console.log('[Notifications] Starting retry polling (every 60s)');
  retryTimerId = setInterval(
    () => void runNotificationMaintenance().catch((e) => console.error('[Notifications] Maintenance error:', e)),
    RETRY_INTERVAL_MS,
  );
}

/**
 * Stop the retry polling loop.
 */
export function stopNotificationRetryPolling(): void {
  if (retryTimerId) {
    clearInterval(retryTimerId);
    retryTimerId = null;
    console.log('[Notifications] Stopped retry polling');
  }
}

/**
 * Get banner alert counts based on user permissions.
 * Returns counts for high-risk escalations, pending deanonymizations, and overdue SLAs.
 */
export async function getBannerAlerts(userId: string): Promise<BannerAlerts> {
  const pool = getPool();

  // Check user role to determine what banners to show
  const userResult = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId],
  );

  const role = userResult.rows[0]?.role ?? '';

  const alerts: BannerAlerts = {
    highRiskEscalations: 0,
    pendingDeanonymizations: 0,
    overdueSlaCounts: 0,
  };

  // Moderators, group_admins, and researchers can see escalation counts
  if (['moderator', 'group_admin', 'researcher', 'admin'].includes(role)) {
    const escalationResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM risk_flags
       WHERE severity = 'high' AND status IN ('open', 'acknowledged')`,
    );
    alerts.highRiskEscalations = escalationResult.rows[0]?.count ?? 0;
  }

  // Group admins / admins can see pending deanonymization requests
  if (['group_admin', 'admin'].includes(role)) {
    const deanonResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM deanonymization_requests
       WHERE status = 'pending'`,
    );
    alerts.pendingDeanonymizations = deanonResult.rows[0]?.count ?? 0;
  }

  // Overdue SLA counts visible to moderators, group_admins, researchers, admins
  if (['moderator', 'group_admin', 'researcher', 'admin'].includes(role)) {
    const overdueResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM risk_flags
       WHERE sla_deadline < NOW() AND status IN ('open', 'acknowledged')`,
    );
    alerts.overdueSlaCounts = overdueResult.rows[0]?.count ?? 0;
  }

  return alerts;
}
