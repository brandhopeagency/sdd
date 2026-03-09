import { getPool } from '../db';
import { getConfig } from './reviewConfig.service';
import type {
  ReviewerDashboardStats,
  TeamDashboardStats,
  ScoreDistribution,
  CriteriaFeedbackCounts,
  WeeklyTrendPoint,
  ReviewerWorkloadEntry,
  QueueDepth,
} from '@mentalhelpglobal/chat-types';

// ── Helpers ──

/**
 * Calculate the date filter for the given period string.
 * Returns a Date for the start of the period, or null for 'all'.
 */
function getDateFilter(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
}

// ── Service Functions ──

/**
 * Get personal reviewer dashboard statistics.
 */
export async function getReviewerStats(
  reviewerId: string,
  period: string,
): Promise<ReviewerDashboardStats> {
  const pool = getPool();
  const dateFilter = getDateFilter(period);

  // Build date condition
  const dateCondition = dateFilter ? 'AND sr.completed_at >= $2' : '';
  const dateParams = dateFilter ? [reviewerId, dateFilter] : [reviewerId];

  // 1. Reviews completed & average score
  const summaryResult = await pool.query(
    `SELECT
       COUNT(*)::int AS reviews_completed,
       AVG(sr.average_score) AS average_score_given
     FROM session_reviews sr
     WHERE sr.reviewer_id = $1
       AND sr.status = 'completed'
       ${dateCondition}`,
    dateParams,
  );

  const reviewsCompleted = summaryResult.rows[0]?.reviews_completed ?? 0;
  const averageScoreGiven = summaryResult.rows[0]?.average_score_given != null
    ? Number(Number(summaryResult.rows[0].average_score_given).toFixed(1))
    : null;

  // 2. Agreement rate — % of reviewer's scores within varianceLimit of session median
  const config = await getConfig();
  let agreementRate = 0;

  if (reviewsCompleted > 0) {
    const agreementResult = await pool.query(
      `WITH session_medians AS (
         SELECT
           session_id,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY average_score)::float AS median_score
         FROM session_reviews
         WHERE status = 'completed'
         GROUP BY session_id
       )
       SELECT
         sr.average_score AS reviewer_score,
         sm.median_score
       FROM session_reviews sr
       JOIN session_medians sm ON sm.session_id = sr.session_id
       WHERE sr.reviewer_id = $1
         AND sr.status = 'completed'
         ${dateCondition}`,
      dateParams,
    );

    if (agreementResult.rows.length > 0) {
      const withinThreshold = agreementResult.rows.filter((r: any) =>
        Math.abs(Number(r.reviewer_score) - Number(r.median_score)) <= config.varianceLimit,
      ).length;
      agreementRate = Math.round((withinThreshold / agreementResult.rows.length) * 100);
    }
  }

  // 3. Score distribution — from message_ratings joined with reviewer's reviews
  const distResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE mr.score >= 9)::int AS outstanding,
       COUNT(*) FILTER (WHERE mr.score >= 7 AND mr.score <= 8)::int AS good,
       COUNT(*) FILTER (WHERE mr.score >= 5 AND mr.score <= 6)::int AS adequate,
       COUNT(*) FILTER (WHERE mr.score >= 3 AND mr.score <= 4)::int AS poor,
       COUNT(*) FILTER (WHERE mr.score <= 2)::int AS unsafe
     FROM message_ratings mr
     JOIN session_reviews sr ON sr.id = mr.review_id
     WHERE sr.reviewer_id = $1
       AND sr.status = 'completed'
       ${dateCondition}`,
    dateParams,
  );

  const scoreDistribution: ScoreDistribution = {
    outstanding: distResult.rows[0]?.outstanding ?? 0,
    good: distResult.rows[0]?.good ?? 0,
    adequate: distResult.rows[0]?.adequate ?? 0,
    poor: distResult.rows[0]?.poor ?? 0,
    unsafe: distResult.rows[0]?.unsafe ?? 0,
  };

  // 4. Criteria feedback counts
  const criteriaResult = await pool.query(
    `SELECT
       cf.criterion,
       COUNT(*)::int AS cnt
     FROM criteria_feedback cf
     JOIN message_ratings mr ON mr.id = cf.rating_id
     JOIN session_reviews sr ON sr.id = mr.review_id
     WHERE sr.reviewer_id = $1
       AND sr.status = 'completed'
       ${dateCondition}
     GROUP BY cf.criterion`,
    dateParams,
  );

  const criteriaFeedbackCounts: CriteriaFeedbackCounts = {
    relevance: 0,
    empathy: 0,
    safety: 0,
    ethics: 0,
    clarity: 0,
  };

  for (const row of criteriaResult.rows) {
    const key = row.criterion as keyof CriteriaFeedbackCounts;
    if (key in criteriaFeedbackCounts) {
      criteriaFeedbackCounts[key] = row.cnt;
    }
  }

  // 5. Weekly trend — last 12 weeks
  const trendResult = await pool.query(
    `SELECT
       date_trunc('week', sr.completed_at)::text AS week,
       COUNT(*)::int AS reviews_completed,
       COALESCE(AVG(sr.average_score), 0) AS average_score
     FROM session_reviews sr
     WHERE sr.reviewer_id = $1
       AND sr.status = 'completed'
       AND sr.completed_at >= NOW() - INTERVAL '12 weeks'
     GROUP BY date_trunc('week', sr.completed_at)
     ORDER BY week ASC`,
    [reviewerId],
  );

  const weeklyTrend: WeeklyTrendPoint[] = trendResult.rows.map((row: any) => ({
    week: row.week,
    reviewsCompleted: row.reviews_completed,
    averageScore: Number(Number(row.average_score).toFixed(1)),
  }));

  return {
    reviewsCompleted,
    averageScoreGiven,
    agreementRate,
    scoreDistribution,
    criteriaFeedbackCounts,
    weeklyTrend,
  };
}

/**
 * Get team-wide dashboard statistics.
 */
export async function getTeamStats(
  period: string,
): Promise<TeamDashboardStats> {
  const pool = getPool();
  const dateFilter = getDateFilter(period);

  // Build date condition for session_reviews
  const dateCondition = dateFilter ? 'AND sr.completed_at >= $1' : '';
  const dateParams = dateFilter ? [dateFilter] : [];

  // 1. Total reviews & average team score
  const summaryResult = await pool.query(
    `SELECT
       COUNT(*)::int AS total_reviews,
       AVG(sr.average_score) AS average_team_score
     FROM session_reviews sr
     WHERE sr.status = 'completed'
       ${dateCondition}`,
    dateParams,
  );

  const totalReviews = summaryResult.rows[0]?.total_reviews ?? 0;
  const averageTeamScore = summaryResult.rows[0]?.average_team_score != null
    ? Number(Number(summaryResult.rows[0].average_team_score).toFixed(1))
    : null;

  // 2. Inter-rater reliability
  // Calculated as avg(1 - variance/maxPossibleVariance) across sessions with 2+ reviews
  // Max possible variance on a 1-10 scale = (10-1)^2 = 81 (using statistical variance)
  const irrResult = await pool.query(
    `SELECT
       AVG(1.0 - (VARIANCE(sr.average_score) / 81.0)) AS irr
     FROM session_reviews sr
     WHERE sr.status = 'completed'
       ${dateCondition}
     GROUP BY sr.session_id
     HAVING COUNT(*) >= 2`,
    dateParams,
  );

  // Average across all sessions
  let interRaterReliability = 0;
  if (irrResult.rows.length > 0) {
    const irrValues = irrResult.rows.map((r: any) => Number(r.irr));
    const avg = irrValues.reduce((s: number, v: number) => s + v, 0) / irrValues.length;
    interRaterReliability = Math.round(Math.max(0, Math.min(1, avg)) * 100);
  }

  // 3. Pending escalations
  const escalationsResult = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM risk_flags
     WHERE status IN ('open', 'acknowledged')`,
  );
  const pendingEscalations = escalationsResult.rows[0]?.cnt ?? 0;

  // 4. Pending deanonymizations
  const deanonResult = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM deanonymization_requests
     WHERE status = 'pending'`,
  );
  const pendingDeanonymizations = deanonResult.rows[0]?.cnt ?? 0;

  // 5. Reviewer workload (period-filtered for completed counts, in-progress always current)
  const workloadCompletedCondition = dateFilter ? 'AND sr.completed_at >= $1' : '';
  const workloadParams = dateFilter ? [dateFilter] : [];
  const workloadResult = await pool.query(
    `SELECT
       sr.reviewer_id,
       COALESCE(u.display_name, u.email, sr.reviewer_id) AS reviewer_name,
       COUNT(*) FILTER (WHERE sr.status = 'completed' ${workloadCompletedCondition})::int AS reviews_completed,
       COUNT(*) FILTER (WHERE sr.status IN ('pending', 'in_progress'))::int AS reviews_in_progress,
       COALESCE(AVG(sr.average_score) FILTER (WHERE sr.status = 'completed' ${workloadCompletedCondition}), 0) AS average_score
     FROM session_reviews sr
     LEFT JOIN users u ON u.id = sr.reviewer_id
     GROUP BY sr.reviewer_id, u.display_name, u.email
     ORDER BY reviews_completed DESC`,
    workloadParams,
  );

  const reviewerWorkload: ReviewerWorkloadEntry[] = workloadResult.rows.map((row: any) => ({
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    reviewsCompleted: row.reviews_completed,
    reviewsInProgress: row.reviews_in_progress,
    averageScore: Number(Number(row.average_score).toFixed(1)),
  }));

  // 6. Queue depth
  const queueResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE review_status = 'pending_review')::int AS pending_review,
       COUNT(*) FILTER (WHERE review_status = 'in_review')::int AS in_review,
       COUNT(*) FILTER (WHERE review_status = 'disputed')::int AS disputed,
       COUNT(*) FILTER (WHERE review_status IN ('complete', 'disputed_closed'))::int AS complete
     FROM sessions
     WHERE review_status IS NOT NULL`,
  );

  const queueDepth: QueueDepth = {
    pendingReview: queueResult.rows[0]?.pending_review ?? 0,
    inReview: queueResult.rows[0]?.in_review ?? 0,
    disputed: queueResult.rows[0]?.disputed ?? 0,
    complete: queueResult.rows[0]?.complete ?? 0,
  };

  return {
    totalReviews,
    averageTeamScore,
    interRaterReliability,
    pendingEscalations,
    pendingDeanonymizations,
    reviewerWorkload,
    queueDepth,
  };
}
