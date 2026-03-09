import { getPool } from '../db';
import { getConfig } from './reviewConfig.service';
import { aggregateSessionScores } from './reviewScoring.service';
import { checkScoreAutoFlag } from './riskFlag.service';
import { markForSupervision } from './supervision.service';
import type {
  SessionReview,
  MessageRating,
  CriteriaFeedback,
  ReviewConfigSnapshot,
} from '@mentalhelpglobal/chat-types';

// ── Row mappers ──

function rowToSessionReview(row: any): SessionReview {
  return {
    id: row.id,
    sessionId: row.session_id,
    reviewerId: row.reviewer_id,
    status: row.status,
    isTiebreaker: Boolean(row.is_tiebreaker),
    averageScore: row.average_score != null ? Number(row.average_score) : null,
    overallComment: row.overall_comment ?? null,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    expiresAt: row.expires_at ?? null,
    configSnapshot: row.config_snapshot ?? null,
    supervisionStatus: row.supervision_status ?? null,
    supervisionRequired: Boolean(row.supervision_required),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMessageRating(row: any): MessageRating {
  return {
    id: row.id,
    reviewId: row.review_id,
    messageId: row.message_id,
    score: Number(row.score),
    comment: row.comment ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCriteriaFeedback(row: any): CriteriaFeedback {
  return {
    id: row.id,
    ratingId: row.rating_id,
    criterion: row.criterion,
    feedbackText: row.feedback_text,
    createdAt: row.created_at,
  };
}

function isAssistantRole(role: unknown): boolean {
  const normalized = String(role ?? '').trim().toLowerCase();
  return (
    normalized === 'assistant' ||
    normalized === 'ai' ||
    normalized === 'bot' ||
    normalized === 'model' ||
    normalized === 'agent'
  );
}

// ── Service functions ──

/**
 * Create a new review for a session by a reviewer.
 * Checks for duplicate reviews, review count limits, and creates with config snapshot.
 */
export async function createReview(
  sessionId: string,
  reviewerId: string,
): Promise<SessionReview> {
  const pool = getPool();

  // Check no existing review for this session+reviewer
  const existing = await pool.query(
    'SELECT id FROM session_reviews WHERE session_id = $1 AND reviewer_id = $2',
    [sessionId, reviewerId],
  );

  if (existing.rows.length > 0) {
    const error: any = new Error('A review already exists for this session and reviewer');
    error.statusCode = 409;
    error.code = 'CONFLICT';
    throw error;
  }

  // Load config for timeout and snapshot
  const config = await getConfig();

  const configSnapshot: ReviewConfigSnapshot = {
    minReviews: config.minReviews,
    maxReviews: config.maxReviews,
    criteriaThreshold: config.criteriaThreshold,
    autoFlagThreshold: config.autoFlagThreshold,
    varianceLimit: config.varianceLimit,
    timeoutHours: config.timeoutHours,
  };

  // Check session review_count < maxReviews
  const sessionResult = await pool.query(
    'SELECT review_count FROM sessions WHERE id = $1',
    [sessionId],
  );

  if (sessionResult.rows.length === 0) {
    const error: any = new Error('Session not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const reviewCount = Number(sessionResult.rows[0].review_count ?? 0);
  if (reviewCount >= configSnapshot.maxReviews) {
    const error: any = new Error('Maximum number of reviews reached for this session');
    error.statusCode = 400;
    error.code = 'MAX_REVIEWS_REACHED';
    throw error;
  }

  // INSERT new review
  const result = await pool.query(
    `INSERT INTO session_reviews (
      session_id, reviewer_id, status, is_tiebreaker,
      expires_at, config_snapshot
    )
    VALUES ($1, $2, 'pending', false, NOW() + ($3 || ' hours')::INTERVAL, $4)
    RETURNING *`,
    [sessionId, reviewerId, String(configSnapshot.timeoutHours), JSON.stringify(configSnapshot)],
  );

  return rowToSessionReview(result.rows[0]);
}

/**
 * Get a review by its ID.
 */
export async function getReviewById(reviewId: string): Promise<SessionReview | null> {
  const pool = getPool();

  const result = await pool.query(
    'SELECT * FROM session_reviews WHERE id = $1',
    [reviewId],
  );

  if (result.rows.length === 0) return null;
  return rowToSessionReview(result.rows[0]);
}

/**
 * Get a review by session ID and reviewer ID.
 */
export async function getReviewBySessionAndReviewer(
  sessionId: string,
  reviewerId: string,
): Promise<SessionReview | null> {
  const pool = getPool();

  const result = await pool.query(
    'SELECT * FROM session_reviews WHERE session_id = $1 AND reviewer_id = $2',
    [sessionId, reviewerId],
  );

  if (result.rows.length === 0) return null;
  return rowToSessionReview(result.rows[0]);
}

/**
 * Update the status of a review.
 * Automatically sets started_at when transitioning to 'in_progress'.
 */
export async function updateReviewStatus(
  reviewId: string,
  status: string,
): Promise<void> {
  const pool = getPool();
  const shouldSetStartedAt = status === 'in_progress';

  await pool.query(
    `UPDATE session_reviews
     SET status = $1,
         started_at = CASE WHEN $2 THEN NOW() ELSE started_at END
     WHERE id = $3`,
    [status, shouldSetStartedAt, reviewId],
  );
}

/**
 * Compute the average score across all message ratings for a review.
 */
export async function computeAverageScore(reviewId: string): Promise<number> {
  const pool = getPool();

  const result = await pool.query(
    'SELECT AVG(score)::DECIMAL(3,1) AS avg_score FROM message_ratings WHERE review_id = $1',
    [reviewId],
  );

  return Number(result.rows[0]?.avg_score ?? 0);
}

/**
 * Save or update a rating for a message within a review.
 * Handles criteria feedback validation and persistence.
 */
export async function saveRating(
  reviewId: string,
  messageId: string,
  score: number,
  comment: string | null,
  criteriaFeedback?: Array<{ criterion: string; feedbackText: string }>,
): Promise<MessageRating> {
  const pool = getPool();

  // Get the review's config snapshot and current status
  const reviewResult = await pool.query(
    'SELECT session_id, config_snapshot, status FROM session_reviews WHERE id = $1',
    [reviewId],
  );

  if (reviewResult.rows.length === 0) {
    const error: any = new Error('Review not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const snapshot = reviewResult.rows[0].config_snapshot;
  const criteriaThreshold = snapshot?.criteriaThreshold ?? 7;

  // Validate criteria feedback: score ≤ threshold requires at least 1 criterion selected.
  // Individual feedbackText per criterion is optional (checkbox-style).
  if (score <= criteriaThreshold) {
    if (!criteriaFeedback || criteriaFeedback.length === 0) {
      const error: any = new Error(
        `At least one criteria feedback entry is required for scores of ${criteriaThreshold} or below`,
      );
      error.statusCode = 400;
      error.code = 'CRITERIA_REQUIRED';
      throw error;
    }
  }

  // Validate the message belongs to the review's session and is an assistant message
  const msgCheckResult = await pool.query(
    `SELECT sm.role FROM session_messages sm
     JOIN session_reviews sr ON sr.session_id = sm.session_id
     WHERE sm.id = $1 AND sr.id = $2`,
    [messageId, reviewId],
  );

  if (msgCheckResult.rows.length > 0 && !isAssistantRole(msgCheckResult.rows[0].role)) {
    const error: any = new Error('Only assistant messages can be rated');
    error.statusCode = 400;
    error.code = 'NOT_REVIEWABLE';
    throw error;
  }
  // If no DB message row exists, allow rating for archived/GCS-backed sessions
  // where reviewable message IDs are generated from transcript payloads.

  // UPSERT the rating. Some older environments may miss the expected
  // unique constraint for ON CONFLICT(review_id, message_id), so fallback
  // to explicit update/insert logic in that case.
  const reviewSessionId = reviewResult.rows[0].session_id as string;
  let ratingId: string | null = null;

  const upsertRating = async (): Promise<string> => {
    const ratingResult = await pool.query(
      `INSERT INTO message_ratings (review_id, message_id, score, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (review_id, message_id) DO UPDATE
         SET score = EXCLUDED.score, comment = EXCLUDED.comment, updated_at = NOW()
       RETURNING id`,
      [reviewId, messageId, score, comment],
    );
    return ratingResult.rows[0].id;
  };
  try {
    ratingId = await upsertRating();
  } catch (error: any) {
    if (error?.code === '23503' && error?.constraint === 'message_ratings_message_id_fkey') {
      // Archived sessions may expose assistant messages from GCS that are not present
      // in session_messages. Create a minimal placeholder row to satisfy FK and retry.
      try {
        await pool.query(
          `INSERT INTO session_messages (id, session_id, role, content, timestamp)
           VALUES ($1::uuid, $2::uuid, 'assistant', '[archived review message]', NOW())
           ON CONFLICT (id) DO NOTHING`,
          [messageId, reviewSessionId],
        );
      } catch (placeholderError: any) {
        if (placeholderError?.code !== '22P02' && placeholderError?.code !== '42804') {
          throw placeholderError;
        }
        await pool.query(
          `INSERT INTO session_messages (id, session_id, role, content, timestamp)
           VALUES ($1, $2, 'assistant', '[archived review message]', NOW())
           ON CONFLICT (id) DO NOTHING`,
          [messageId, reviewSessionId],
        );
      }
      ratingId = await upsertRating();
    } else if (error?.code !== '42P10') {
      throw error;
    }

    if (error?.code === '42P10') {
      const existingRating = await pool.query(
        'SELECT id FROM message_ratings WHERE review_id = $1 AND message_id = $2',
        [reviewId, messageId],
      );

      if (existingRating.rows.length > 0) {
        ratingId = existingRating.rows[0].id;
        await pool.query(
          `UPDATE message_ratings
           SET score = $1, comment = $2, updated_at = NOW()
           WHERE id = $3`,
          [score, comment, ratingId],
        );
      } else {
        const inserted = await pool.query(
          `INSERT INTO message_ratings (review_id, message_id, score, comment)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [reviewId, messageId, score, comment],
        );
        ratingId = inserted.rows[0].id;
      }
    }
  }
  if (!ratingId) {
    throw new Error('Failed to persist rating');
  }

  // Auto-transition review from 'pending' to 'in_progress' on first rating
  const currentStatus = reviewResult.rows[0].status;
  if (currentStatus === 'pending') {
    await updateReviewStatus(reviewId, 'in_progress');
  }

  // Handle criteria feedback
  if (criteriaFeedback && criteriaFeedback.length > 0) {
    // Delete existing feedback for this rating
    await pool.query(
      'DELETE FROM criteria_feedback WHERE rating_id = $1',
      [ratingId],
    );

    // Insert each feedback entry
    for (const fb of criteriaFeedback) {
      await pool.query(
        `INSERT INTO criteria_feedback (rating_id, criterion, feedback_text)
         VALUES ($1, $2, $3)`,
        [ratingId, fb.criterion, fb.feedbackText],
      );
    }
  }

  // FR-018: Auto-flag if individual message score ≤ 2
  if (score <= 2) {
    const sessionIdResult = await pool.query(
      'SELECT session_id FROM session_reviews WHERE id = $1',
      [reviewId],
    );
    const sessionId = sessionIdResult.rows[0]?.session_id;
    if (sessionId) {
      await checkScoreAutoFlag(sessionId, score, 'low_score');
    }
  }

  const savedRatingResult = await pool.query(
    'SELECT * FROM message_ratings WHERE id = $1',
    [ratingId],
  );
  const savedRating = rowToMessageRating(savedRatingResult.rows[0]);
  if (!criteriaFeedback || criteriaFeedback.length === 0) {
    return savedRating;
  }

  const feedbackRows = await pool.query(
    'SELECT * FROM criteria_feedback WHERE rating_id = $1 ORDER BY created_at ASC',
    [ratingId],
  );
  return {
    ...savedRating,
    criteriaFeedback: feedbackRows.rows.map(rowToCriteriaFeedback),
  };
}

/**
 * Get all ratings for a review, including nested criteria feedback.
 */
export async function getRatingsForReview(reviewId: string): Promise<MessageRating[]> {
  const pool = getPool();

  // Get all ratings for this review
  const ratingsResult = await pool.query(
    'SELECT * FROM message_ratings WHERE review_id = $1 ORDER BY created_at ASC',
    [reviewId],
  );

  if (ratingsResult.rows.length === 0) return [];

  // Get all criteria feedback for these ratings
  const ratingIds = ratingsResult.rows.map((r: any) => r.id);
  const feedbackResult = await pool.query(
    `SELECT * FROM criteria_feedback WHERE rating_id = ANY($1) ORDER BY created_at ASC`,
    [ratingIds],
  );

  // Group feedback by rating_id
  const feedbackByRatingId = new Map<string, CriteriaFeedback[]>();
  for (const row of feedbackResult.rows) {
    const fb = rowToCriteriaFeedback(row);
    const existing = feedbackByRatingId.get(fb.ratingId) || [];
    existing.push(fb);
    feedbackByRatingId.set(fb.ratingId, existing);
  }

  // Map ratings with nested feedback
  return ratingsResult.rows.map((row: any) => {
    const rating = rowToMessageRating(row);
    rating.criteriaFeedback = feedbackByRatingId.get(rating.id) || [];
    return rating;
  });
}

/**
 * Submit a completed review.
 * Validates all AI messages are rated, computes average, updates review and session.
 */
export async function submitReview(
  reviewId: string,
  overallComment?: string | null,
): Promise<SessionReview> {
  const pool = getPool();

  // Get the review
  const review = await getReviewById(reviewId);
  if (!review) {
    const error: any = new Error('Review not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Verify status is pending or in_progress
  if (review.status !== 'pending' && review.status !== 'in_progress') {
    const error: any = new Error('Review is not in a submittable state');
    error.statusCode = 400;
    error.code = 'INVALID_STATUS';
    throw error;
  }

  // Count AI messages for the session
  const aiMessageCountResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM session_messages
     WHERE session_id = $1
       AND LOWER(TRIM(role)) IN ('assistant', 'ai', 'bot', 'model', 'agent')`,
    [review.sessionId],
  );
  const aiMessageCount = aiMessageCountResult.rows[0]?.count ?? 0;

  // Count ratings for this review
  const ratingsCountResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM message_ratings WHERE review_id = $1',
    [reviewId],
  );
  const ratingsCount = ratingsCountResult.rows[0]?.count ?? 0;

  // Validate all AI messages are rated
  if (ratingsCount < aiMessageCount) {
    const error: any = new Error('All AI messages must be rated before submitting the review');
    error.statusCode = 400;
    error.code = 'INCOMPLETE_RATINGS';
    throw error;
  }

  // Compute average score
  const averageScore = await computeAverageScore(reviewId);

  // Update review to completed
  const updateResult = await pool.query(
    `UPDATE session_reviews
     SET status = 'completed',
         average_score = $1,
         overall_comment = $2,
         completed_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [averageScore, overallComment ?? null, reviewId],
  );

  // Increment session review_count
  await pool.query(
    'UPDATE sessions SET review_count = review_count + 1 WHERE id = $1',
    [review.sessionId],
  );

  // Insert audit log entry
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      review.reviewerId,
      'review_submitted',
      'session',
      review.sessionId,
      JSON.stringify({
        reviewId,
        averageScore,
        reviewerId: review.reviewerId,
      }),
    ],
  );

  // FR-025: Auto-flag if review average score ≤ autoFlagThreshold
  const config = await getConfig();
  if (averageScore <= config.autoFlagThreshold) {
    await checkScoreAutoFlag(review.sessionId, averageScore, 'below_threshold');
  }

  // Trigger score aggregation after review submission
  await aggregateSessionScores(review.sessionId);

  // Determine if this review needs supervision
  const sessionRow = await pool.query('SELECT group_id FROM sessions WHERE id = $1', [review.sessionId]);
  const groupId = sessionRow.rows[0]?.group_id ?? null;
  await markForSupervision(reviewId, groupId);

  // Re-fetch after supervision status update
  const finalResult = await pool.query('SELECT * FROM session_reviews WHERE id = $1', [reviewId]);
  return rowToSessionReview(finalResult.rows[0]);
}
