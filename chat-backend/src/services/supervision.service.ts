import { getPool } from '../db';
import { getConfig } from './reviewConfig.service';
import type {
  SupervisorReview,
  SupervisorDecisionInput,
  SupervisionQueueItem,
  AwaitingFeedbackItem,
  SupervisionPolicy,
  GroupReviewConfig,
} from '@mentalhelpglobal/chat-types';

function rowToSupervisorReview(row: any): SupervisorReview {
  return {
    id: row.id,
    sessionReviewId: row.session_review_id,
    supervisorId: row.supervisor_id,
    decision: row.decision,
    comments: row.comments,
    returnToReviewer: Boolean(row.return_to_reviewer),
    revisionIteration: Number(row.revision_iteration),
    createdAt: row.created_at,
  };
}

function rowToQueueItem(row: any): SupervisionQueueItem {
  return {
    sessionReviewId: row.session_review_id,
    sessionId: row.session_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    submittedAt: row.submitted_at,
    revisionIteration: Number(row.revision_iteration),
    sessionMessageCount: Number(row.session_message_count),
    groupName: row.group_name ?? '',
  };
}

function rowToAwaitingItem(row: any): AwaitingFeedbackItem {
  return {
    sessionReviewId: row.session_review_id,
    sessionId: row.session_id,
    supervisorDecision: row.decision,
    supervisorComments: row.comments,
    returnToReviewer: Boolean(row.return_to_reviewer),
    decidedAt: row.decided_at,
    revisionIteration: Number(row.revision_iteration),
  };
}

/**
 * Resolve the effective supervision policy for a session's group.
 * Falls back to global config for any NULL group-level fields.
 */
export async function getEffectiveSupervisionPolicy(
  groupId: string | null,
): Promise<{ policy: SupervisionPolicy; samplePercentage: number }> {
  const globalConfig = await getConfig();
  if (!groupId) {
    return {
      policy: globalConfig.supervisionPolicy,
      samplePercentage: globalConfig.supervisionSamplePercentage,
    };
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT supervision_policy, supervision_sample_percentage FROM group_review_config WHERE group_id = $1',
    [groupId],
  );

  if (result.rows.length === 0) {
    return {
      policy: globalConfig.supervisionPolicy,
      samplePercentage: globalConfig.supervisionSamplePercentage,
    };
  }

  const groupConfig = result.rows[0];
  return {
    policy: groupConfig.supervision_policy ?? globalConfig.supervisionPolicy,
    samplePercentage: groupConfig.supervision_sample_percentage ?? globalConfig.supervisionSamplePercentage,
  };
}

/**
 * Determine if a review should be supervised based on the effective policy.
 */
export function shouldSupervise(policy: SupervisionPolicy, samplePercentage: number): boolean {
  if (policy === 'none') return false;
  if (policy === 'all') return true;
  return Math.random() * 100 < samplePercentage;
}

/**
 * Mark a review for supervision after it is submitted.
 */
export async function markForSupervision(reviewId: string, groupId: string | null): Promise<void> {
  const { policy, samplePercentage } = await getEffectiveSupervisionPolicy(groupId);
  const required = shouldSupervise(policy, samplePercentage);

  const pool = getPool();
  await pool.query(
    `UPDATE session_reviews
     SET supervision_required = $1,
         supervision_status = $2
     WHERE id = $3`,
    [required, required ? 'pending_supervision' : 'not_required', reviewId],
  );
}

/**
 * Get the supervision queue — reviews awaiting supervisor evaluation.
 */
export async function getSupervisionQueue(): Promise<SupervisionQueueItem[]> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT
      sr.id AS session_review_id,
      sr.session_id,
      sr.reviewer_id,
      u.display_name AS reviewer_name,
      sr.completed_at AS submitted_at,
      COALESCE(
        (SELECT MAX(sv.revision_iteration) FROM supervisor_reviews sv WHERE sv.session_review_id = sr.id),
        0
      ) + 1 AS revision_iteration,
      (SELECT COUNT(*)::int FROM session_messages sm WHERE sm.session_id = sr.session_id) AS session_message_count,
      COALESCE(g.name, '') AS group_name
    FROM session_reviews sr
    JOIN users u ON u.id = sr.reviewer_id
    LEFT JOIN sessions s ON s.id = sr.session_id
    LEFT JOIN groups g ON g.id = s.group_id
    WHERE sr.supervision_status = 'pending_supervision'
    ORDER BY sr.completed_at ASC
  `);

  return result.rows.map(rowToQueueItem);
}

/**
 * Get full review context for a supervisor: the review, its ratings, and any prior supervisor decisions.
 */
export async function getSupervisionContext(sessionReviewId: string): Promise<{
  review: any;
  ratings: any[];
  priorDecisions: SupervisorReview[];
}> {
  const pool = getPool();

  const reviewResult = await pool.query('SELECT * FROM session_reviews WHERE id = $1', [sessionReviewId]);
  if (reviewResult.rows.length === 0) {
    const error: any = new Error('Review not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const ratingsResult = await pool.query(
    `SELECT mr.*, 
       COALESCE(
         json_agg(json_build_object('id', cf.id, 'criterion', cf.criterion, 'feedback_text', cf.feedback_text))
         FILTER (WHERE cf.id IS NOT NULL),
         '[]'
       ) AS criteria_feedback
     FROM message_ratings mr
     LEFT JOIN criteria_feedback cf ON cf.rating_id = mr.id
     WHERE mr.review_id = $1
     GROUP BY mr.id
     ORDER BY mr.created_at ASC`,
    [sessionReviewId],
  );

  const decisionsResult = await pool.query(
    'SELECT * FROM supervisor_reviews WHERE session_review_id = $1 ORDER BY revision_iteration ASC',
    [sessionReviewId],
  );

  return {
    review: reviewResult.rows[0],
    ratings: ratingsResult.rows,
    priorDecisions: decisionsResult.rows.map(rowToSupervisorReview),
  };
}

/**
 * Submit a supervisor decision on a review.
 */
export async function submitDecision(
  sessionReviewId: string,
  supervisorId: string,
  input: SupervisorDecisionInput,
): Promise<SupervisorReview> {
  const pool = getPool();

  const reviewResult = await pool.query('SELECT * FROM session_reviews WHERE id = $1', [sessionReviewId]);
  if (reviewResult.rows.length === 0) {
    const error: any = new Error('Review not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const review = reviewResult.rows[0];
  if (review.supervision_status !== 'pending_supervision') {
    const error: any = new Error('Review is not pending supervision');
    error.statusCode = 400;
    error.code = 'INVALID_STATUS';
    throw error;
  }

  // Determine current iteration
  const iterResult = await pool.query(
    'SELECT COALESCE(MAX(revision_iteration), 0)::int AS max_iter FROM supervisor_reviews WHERE session_review_id = $1',
    [sessionReviewId],
  );
  const nextIteration = iterResult.rows[0].max_iter + 1;

  if (nextIteration > 3) {
    const error: any = new Error('Maximum revision iterations reached');
    error.statusCode = 400;
    error.code = 'MAX_ITERATIONS';
    throw error;
  }

  const returnToReviewer = input.decision === 'disapproved' && Boolean(input.returnToReviewer);

  // Insert supervisor review
  const insertResult = await pool.query(
    `INSERT INTO supervisor_reviews (session_review_id, supervisor_id, decision, comments, return_to_reviewer, revision_iteration)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [sessionReviewId, supervisorId, input.decision, input.comments, returnToReviewer, nextIteration],
  );

  // Update session review supervision status
  let newStatus: string;
  if (input.decision === 'approved') {
    newStatus = 'approved';
  } else if (returnToReviewer && nextIteration < 3) {
    newStatus = 'revision_requested';
  } else {
    newStatus = 'disapproved';
  }

  await pool.query(
    'UPDATE session_reviews SET supervision_status = $1 WHERE id = $2',
    [newStatus, sessionReviewId],
  );

  // Audit log
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      supervisorId,
      'supervision_decision',
      'session_review',
      sessionReviewId,
      JSON.stringify({ decision: input.decision, returnToReviewer, iteration: nextIteration }),
    ],
  );

  return rowToSupervisorReview(insertResult.rows[0]);
}

/**
 * Get reviews awaiting feedback for a specific reviewer.
 */
export async function getAwaitingFeedback(reviewerId: string): Promise<AwaitingFeedbackItem[]> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT
      sr.id AS session_review_id,
      sr.session_id,
      sv.decision,
      sv.comments,
      sv.return_to_reviewer,
      sv.created_at AS decided_at,
      sv.revision_iteration
    FROM session_reviews sr
    JOIN supervisor_reviews sv ON sv.session_review_id = sr.id
    WHERE sr.reviewer_id = $1
      AND sr.supervision_status IN ('disapproved', 'revision_requested', 'approved')
      AND sv.revision_iteration = (
        SELECT MAX(sv2.revision_iteration)
        FROM supervisor_reviews sv2
        WHERE sv2.session_review_id = sr.id
      )
    ORDER BY sv.created_at DESC
  `, [reviewerId]);

  return result.rows.map(rowToAwaitingItem);
}

/**
 * Get group review config for a group.
 */
export async function getGroupReviewConfig(groupId: string): Promise<GroupReviewConfig | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM group_review_config WHERE group_id = $1', [groupId]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    groupId: row.group_id,
    reviewerCountOverride: row.reviewer_count_override,
    supervisionPolicy: row.supervision_policy,
    supervisionSamplePercentage: row.supervision_sample_percentage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
