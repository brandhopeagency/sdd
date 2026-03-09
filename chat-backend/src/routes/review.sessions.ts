import { Router, Request, Response } from 'express';
import {
  reviewAuth,
  requireReviewAccess,
  requireReviewSubmit,
} from '../middleware/reviewAuth';
import {
  createReview,
  getReviewBySessionAndReviewer,
  saveRating,
  submitReview,
} from '../services/review.service';
import { getPool } from '../db';
import {
  getAnonymousSessionId,
  generateAnonymousId,
} from '../services/anonymization.service';
import { getConversation } from '../services/gcs.service';
import { extractRAGDetails } from '../services/rag.service';
import type { ReviewSummary } from '@mentalhelpglobal/chat-types';
import { UserRole } from '../types';
import { canAccessGroupScopedQueue } from '../services/reviewQueue.service';

const router = Router();
router.use(...reviewAuth);

// ── Helpers ──

function anonymizeMessage(msg: any, isReviewable?: boolean): any {
  const normalizedRole = String(msg.role ?? '').trim().toLowerCase();
  const assistantLike =
    normalizedRole === 'assistant' ||
    normalizedRole === 'ai' ||
    normalizedRole === 'bot' ||
    normalizedRole === 'model' ||
    normalizedRole === 'agent';

  const ragCallDetail = assistantLike
    ? extractRAGDetails(msg.metadata ?? msg.diagnostic_info ?? msg.diagnosticInfo)
    : undefined;

  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp instanceof Date ? msg.timestamp : msg.timestamp,
    metadata: {
      confidence: msg.generative_info?.confidence ?? undefined,
      intent: msg.intent_info?.displayName ?? undefined,
    },
    isReviewable: typeof isReviewable === 'boolean' ? isReviewable : assistantLike,
    ...(ragCallDetail ? { ragCallDetail } : {}),
  };
}

// ── Routes ──

/**
 * GET /:sessionId
 * Get anonymized session detail with messages and the current reviewer's review.
 * (Mounted at /api/review/sessions, so full path is /api/review/sessions/:sessionId)
 */
router.get(
  '/:sessionId',
  requireReviewAccess,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { groupId } = req.query as { groupId?: string };
      const reviewerId = req.user?.id;
      const pool = getPool();

      if (groupId && req.user?.role !== UserRole.OWNER) {
        const hasAccess = await canAccessGroupScopedQueue(req.user!.id, groupId);
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'You do not have access to the selected group' },
          });
        }
      }

      // Load session
      const sessionQuery = groupId
        ? `SELECT id, user_id, group_id, message_count, review_status, review_count,
                reviews_required, risk_level, language, auto_flagged,
                started_at, ended_at, review_final_score, tiebreaker_reviewer_id, gcs_path
           FROM sessions WHERE id = $1 AND group_id = $2::uuid`
        : `SELECT id, user_id, group_id, message_count, review_status, review_count,
                reviews_required, risk_level, language, auto_flagged,
                started_at, ended_at, review_final_score, tiebreaker_reviewer_id, gcs_path
           FROM sessions WHERE id = $1`;
      const sessionParams = groupId ? [sessionId, groupId] : [sessionId];
      const sessionResult = await pool.query(
        sessionQuery,
        sessionParams,
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Session not found' },
        });
      }

      const session = sessionResult.rows[0];

      // Load messages (only user and assistant, exclude system)
      const messagesResult = await pool.query(
        `SELECT * FROM session_messages
         WHERE session_id = $1
           AND (
             LOWER(TRIM(role)) = 'user'
             OR LOWER(TRIM(role)) IN ('assistant', 'ai', 'bot', 'model', 'agent')
           )
         ORDER BY created_at ASC`,
        [sessionId],
      );

      const anonymizedMessages = messagesResult.rows.map((msg: any) =>
        anonymizeMessage(msg),
      );

      // Fallback: for archived sessions, DB message rows may be cleaned up while
      // full conversation is still available in GCS.
      if (anonymizedMessages.length === 0 && session.gcs_path) {
        try {
          const conversation = await getConversation(session.gcs_path);
          const restored = (conversation.messages ?? [])
            .filter((msg: any) => {
              const normalizedRole = String(msg?.role ?? '').trim().toLowerCase();
              return normalizedRole === 'user' || ['assistant', 'ai', 'bot', 'model', 'agent'].includes(normalizedRole);
            })
            .map((msg: any) => anonymizeMessage({
              id: msg.id ?? `${sessionId}-${msg.timestamp ?? Math.random().toString(36).slice(2)}`,
              role: msg.role,
              content: msg.content ?? '',
              timestamp: msg.timestamp ?? conversation.startedAt ?? new Date().toISOString(),
              generative_info: msg.generativeInfo ?? null,
              intent_info: msg.intentInfo ?? null,
            }));
          anonymizedMessages.push(...restored);
        } catch (gcsError) {
          console.warn('[Review Sessions] GCS fallback failed:', gcsError);
        }
      }

      // Get current reviewer's review if exists
      let myReview = null;
      if (reviewerId) {
        myReview = await getReviewBySessionAndReviewer(sessionId, reviewerId);
      }

      // Anonymize IDs
      const anonymousSessionId = getAnonymousSessionId(sessionId);
      const anonymousUserId = session.user_id
        ? generateAnonymousId(session.user_id, 'USER')
        : 'USER-ANON';

      const reviewStatus = session.review_status ?? 'pending_review';
      const reviewCount = Number(session.review_count ?? 0);
      const reviewsRequired = Number(session.reviews_required ?? 3);
      const reviewFinalScore = session.review_final_score != null
        ? Number(session.review_final_score)
        : null;
      const tiebreakerReviewerId = session.tiebreaker_reviewer_id ?? null;
      const isCurrentUserTiebreaker = reviewerId === tiebreakerReviewerId;

      // ── Blinding logic ──
      // During review: only return the current reviewer's own review + review count
      // After completion: return all reviews with reviewer names
      // For tiebreaker: return score range only, not individual scores

      let allReviews: ReviewSummary[] = [];
      let scoreRange: { min: number; max: number } | null = null;

      const isSessionComplete = reviewStatus === 'complete' || reviewStatus === 'disputed_closed';

      if (isSessionComplete) {
        // Session is complete — reveal all reviews with reviewer names
        const allReviewsResult = await pool.query(
          `SELECT sr.id, sr.average_score, sr.is_tiebreaker, sr.completed_at,
                  u.display_name AS reviewer_name
           FROM session_reviews sr
           JOIN users u ON u.id = sr.reviewer_id
           WHERE sr.session_id = $1 AND sr.status = 'completed'
           ORDER BY sr.completed_at ASC`,
          [sessionId],
        );

        allReviews = allReviewsResult.rows.map((r: any) => ({
          reviewId: r.id,
          reviewerName: r.reviewer_name ?? 'Unknown',
          averageScore: Number(r.average_score),
          isTiebreaker: Boolean(r.is_tiebreaker),
          completedAt: r.completed_at,
        }));
      } else if (isCurrentUserTiebreaker) {
        // Tiebreaker reviewer: show score range (min-max) only
        const rangeResult = await pool.query(
          `SELECT MIN(average_score) AS min_score, MAX(average_score) AS max_score
           FROM session_reviews
           WHERE session_id = $1 AND status = 'completed'`,
          [sessionId],
        );

        if (rangeResult.rows.length > 0 && rangeResult.rows[0].min_score != null) {
          scoreRange = {
            min: Number(rangeResult.rows[0].min_score),
            max: Number(rangeResult.rows[0].max_score),
          };
        }
      }

      res.json({
        success: true,
        data: {
          id: anonymousSessionId,
          anonymousSessionId,
          anonymousUserId,
          messageCount: Number(session.message_count ?? 0),
          reviewStatus,
          reviewCount,
          reviewsRequired,
          reviewFinalScore,
          riskLevel: session.risk_level ?? 'none',
          language: session.language ?? null,
          autoFlagged: Boolean(session.auto_flagged),
          startedAt: session.started_at,
          endedAt: session.ended_at ?? null,
          messages: anonymizedMessages,
          myReview,
          // Multi-reviewer fields
          allReviews: isSessionComplete ? allReviews : undefined,
          scoreRange: isCurrentUserTiebreaker && !isSessionComplete ? scoreRange : undefined,
          isCurrentUserTiebreaker,
        },
      });
    } catch (error) {
      console.error('[Review Sessions] Error getting session:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load session',
        },
      });
    }
  },
);

/**
 * POST /:sessionId/reviews
 * Start a new review for a session.
 */
router.post(
  '/:sessionId/reviews',
  requireReviewSubmit,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const reviewerId = req.user?.id;

      if (!reviewerId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      // Check for duplicate review before creating
      const existingReview = await getReviewBySessionAndReviewer(sessionId, reviewerId);
      if (existingReview) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A review already exists for this session and reviewer',
          },
        });
      }

      const review = await createReview(sessionId, reviewerId);

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error: any) {
      console.error('[Review Sessions] Error creating review:', error);

      const statusCode = error.statusCode || 500;
      const code = error.code || 'INTERNAL_ERROR';
      const message = error.message || 'Failed to create review';

      res.status(statusCode).json({
        success: false,
        error: { code, message },
      });
    }
  },
);

/**
 * PUT /:sessionId/reviews/:reviewId/ratings
 * Save or update a rating for a message within a review.
 */
router.put(
  '/:sessionId/reviews/:reviewId/ratings',
  requireReviewSubmit,
  async (req: Request, res: Response) => {
    try {
      const { reviewId } = req.params;
      const { messageId, score, comment, criteriaFeedback } = req.body || {};

      if (!messageId || typeof score !== 'number') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'messageId and score are required',
          },
        });
      }

      if (score < 1 || score > 10) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Score must be between 1 and 10',
          },
        });
      }

      const savedRating = await saveRating(
        reviewId,
        messageId,
        score,
        comment ?? null,
        criteriaFeedback,
      );

      res.json({ success: true, data: savedRating });
    } catch (error: any) {
      console.error('[Review Sessions] Error saving rating:', error);

      const statusCode = error.statusCode || 500;
      const code = error.code || 'INTERNAL_ERROR';
      const message = error.message || 'Failed to save rating';

      res.status(statusCode).json({
        success: false,
        error: { code, message },
      });
    }
  },
);

/**
 * POST /:sessionId/reviews/:reviewId/submit
 * Submit a completed review.
 */
router.post(
  '/:sessionId/reviews/:reviewId/submit',
  requireReviewSubmit,
  async (req: Request, res: Response) => {
    try {
      const { reviewId } = req.params;
      const { overallComment } = req.body || {};

      const completedReview = await submitReview(reviewId, overallComment ?? null);

      res.json({
        success: true,
        data: completedReview,
      });
    } catch (error: any) {
      console.error('[Review Sessions] Error submitting review:', error);

      const statusCode = error.statusCode || 500;
      const code = error.code || 'INTERNAL_ERROR';
      const message = error.message || 'Failed to submit review';

      res.status(statusCode).json({
        success: false,
        error: { code, message },
      });
    }
  },
);

export default router;
