import { getPool } from '../db';
import { getConfig } from './reviewConfig.service';
import { createNotification, createNotificationsForRole } from './reviewNotification.service';

// ── Helpers ──

/**
 * Calculate the median of a numeric array.
 * Returns the middle value for odd-length arrays,
 * or the average of the two middle values for even-length arrays.
 */
export function calculateMedianScore(scores: number[]): number {
  if (scores.length === 0) return 0;

  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

// ── Core Functions ──

/**
 * Assign a tiebreaker reviewer for a disputed session.
 * Finds an eligible user with RESEARCHER role who hasn't reviewed this session.
 */
export async function assignTiebreaker(sessionId: string): Promise<void> {
  const pool = getPool();

  // Find eligible tiebreaker: researcher who hasn't reviewed this session
  const eligibleResult = await pool.query(
    `SELECT u.id FROM users u
     WHERE u.role = 'researcher'
       AND u.id NOT IN (
         SELECT reviewer_id FROM session_reviews WHERE session_id = $1
       )
     LIMIT 1`,
    [sessionId],
  );

  if (eligibleResult.rows.length === 0) {
    // No eligible tiebreaker available — leave as disputed
    console.warn(`[ReviewScoring] No eligible tiebreaker found for session ${sessionId}`);
    return;
  }

  const tiebreakerId = eligibleResult.rows[0].id;

  // Update session to disputed with tiebreaker assignment
  await pool.query(
    `UPDATE sessions
     SET review_status = 'disputed',
         tiebreaker_reviewer_id = $1
     WHERE id = $2`,
    [tiebreakerId, sessionId],
  );

  // Load config for timeout
  const config = await getConfig();

  // Create a tiebreaker review assignment
  await pool.query(
    `INSERT INTO session_reviews (
      session_id, reviewer_id, status, is_tiebreaker,
      expires_at, config_snapshot
    )
    VALUES ($1, $2, 'pending', true, NOW() + ($3 || ' hours')::INTERVAL, $4)`,
    [
      sessionId,
      tiebreakerId,
      String(config.timeoutHours),
      JSON.stringify({
        minReviews: config.minReviews,
        maxReviews: config.maxReviews,
        criteriaThreshold: config.criteriaThreshold,
        autoFlagThreshold: config.autoFlagThreshold,
        varianceLimit: config.varianceLimit,
        timeoutHours: config.timeoutHours,
      }),
    ],
  );

  // Audit log for tiebreaker assignment
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      'system',
      'tiebreaker_assigned',
      'session',
      sessionId,
      JSON.stringify({
        tiebreakerId,
        reason: 'score_variance_exceeded',
      }),
    ],
  );
}

/**
 * Aggregate all completed review scores for a session and determine outcome.
 *
 * Logic:
 * - If review count < config.minReviews: no action (still needs more reviews)
 * - Calculate average of all review average_scores
 * - Calculate variance: MAX(score) - MIN(score)
 * - If variance <= config.varianceLimit: session is complete
 * - If variance > config.varianceLimit:
 *   - If review count < config.maxReviews: assign a tiebreaker
 *   - If review count >= config.maxReviews: disputed_closed with median score
 */
export async function aggregateSessionScores(sessionId: string): Promise<void> {
  const pool = getPool();

  // Get all completed reviews for this session
  const reviewsResult = await pool.query(
    `SELECT * FROM session_reviews
     WHERE session_id = $1 AND status = 'completed'`,
    [sessionId],
  );

  const completedReviews = reviewsResult.rows;
  if (completedReviews.length === 0) return;

  // Get the review config
  const config = await getConfig();

  // Not enough reviews yet
  if (completedReviews.length < config.minReviews) {
    return;
  }

  // Extract scores
  const scores: number[] = completedReviews.map((r: any) => Number(r.average_score));

  // Calculate average
  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  // Calculate variance (spread): MAX - MIN
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const variance = maxScore - minScore;

  if (variance <= config.varianceLimit) {
    // Scores are in agreement — session is complete
    await pool.query(
      `UPDATE sessions
       SET review_status = 'complete',
           review_final_score = $1
       WHERE id = $2`,
      [Math.round(average * 10) / 10, sessionId],
    );

    // Notify reviewers that their review session is complete
    const reviewersResult = await pool.query(
      'SELECT reviewer_id FROM session_reviews WHERE session_id = $1',
      [sessionId],
    );
    for (const row of reviewersResult.rows) {
      void createNotification({
        recipientId: row.reviewer_id,
        eventType: 'review_complete',
        title: 'Review session complete',
        body: 'A session you reviewed has been finalized.',
        data: { sessionId },
      }).catch((e) => console.warn('[Notifications] Failed to notify reviewer of completion:', e));
    }
  } else {
    // Scores are divergent — notify researchers of dispute
    void createNotificationsForRole(
      'researcher', 'dispute_detected',
      'Score dispute detected',
      `Review scores for a session have high variance (${Math.round(variance * 10) / 10}). Tiebreaker may be needed.`,
      { sessionId, variance: Math.round(variance * 10) / 10, scores },
    ).catch((e) => console.warn('[Notifications] Failed to notify researchers:', e));

    if (completedReviews.length < config.maxReviews) {
      // Still room for a tiebreaker
      await assignTiebreaker(sessionId);
    } else {
      // Max reviews reached — close with median
      const median = calculateMedianScore(scores);

      await pool.query(
        `UPDATE sessions
         SET review_status = 'disputed_closed',
             review_final_score = $1
         WHERE id = $2`,
        [Math.round(median * 10) / 10, sessionId],
      );
    }
  }

  // Audit log for score aggregation
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      'system',
      'scores_aggregated',
      'session',
      sessionId,
      JSON.stringify({
        reviewCount: completedReviews.length,
        scores,
        average: Math.round(average * 10) / 10,
        variance: Math.round(variance * 10) / 10,
        minScore,
        maxScore,
        outcome: variance <= config.varianceLimit
          ? 'complete'
          : completedReviews.length < config.maxReviews
            ? 'tiebreaker_assigned'
            : 'disputed_closed',
      }),
    ],
  );
}
