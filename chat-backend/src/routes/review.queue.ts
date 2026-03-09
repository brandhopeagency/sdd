import { Router, Request, Response } from 'express';
import { reviewAuth, requireReviewAccess, requireReviewAssign } from '../middleware/reviewAuth';
import { listQueueSessions, assignSession, canAccessGroupScopedQueue } from '../services/reviewQueue.service';
import { UserRole } from '../types';

const router = Router();
router.use(...reviewAuth);

/**
 * GET /queue
 * List sessions in the review queue with pagination, tab filtering,
 * multi-criteria filtering, priority sorting, and workload balancing.
 * Returns queue counts alongside the list data.
 * (Mounted at /api/review, so full path is /api/review/queue)
 */
router.get('/queue', requireReviewAccess, async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      pageSize,
      limit,
      tab = 'pending',
      language,
      riskLevel,
      dateFrom,
      dateTo,
      assignedToMe,
      sortBy,
      sort,
      excluded,
      tags,
      groupId,
    } = req.query as Record<string, string>;

    const effectivePageSize = pageSize || limit || '20';
    const effectiveSort = sortBy || sort;

    if (groupId && req.user?.role !== UserRole.OWNER) {
      const hasAccess = await canAccessGroupScopedQueue(req.user!.id, groupId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to the selected group',
          },
        });
      }
    }

    const result = await listQueueSessions({
      page: parseInt(page, 10),
      pageSize: parseInt(effectivePageSize, 10),
      tab,
      language,
      riskLevel,
      dateFrom,
      dateTo,
      assignedToMe: assignedToMe === 'true',
      sortBy: effectiveSort,
      reviewerId: req.user?.id,
      excluded: excluded === 'true',
      tags,
      groupId,
    });

    res.json({
      success: true,
      data: result.data,
      counts: result.counts,
      meta: {
        page: parseInt(page, 10),
        pageSize: parseInt(effectivePageSize, 10),
        total: result.total,
      },
    });
  } catch (error) {
    console.error('[Review Queue] Error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to load review queue',
      },
    });
  }
});

/**
 * GET /tags
 * Return active tag definitions that have at least one session association,
 * with session count per tag, for populating the filter dropdown.
 * (Mounted at /api/review, so full path is /api/review/tags)
 */
router.get('/tags', requireReviewAccess, async (_req: Request, res: Response) => {
  try {
    const { getPool } = await import('../db');
    const pool = getPool();

    let result;
    try {
      result = await pool.query(
        `SELECT td.id, td.name, td.category,
                COUNT(DISTINCT st.session_id)::int AS session_count
         FROM tag_definitions td
         LEFT JOIN session_tags st ON st.tag_definition_id = td.id
         WHERE td.is_active = true
         GROUP BY td.id, td.name, td.category
         ORDER BY td.name`,
      );
    } catch (error: any) {
      if (error?.code !== '42703' && error?.code !== '42P01') {
        throw error;
      }
      // Legacy schema fallback: session_tags.tag_id -> tags(id), category 'session'.
      result = await pool.query(
        `SELECT t.id, t.name, 'chat'::text AS category,
                COUNT(DISTINCT st.session_id)::int AS session_count
         FROM tags t
         LEFT JOIN session_tags st ON st.tag_id = t.id
         WHERE t.category = 'session'
         GROUP BY t.id, t.name
         ORDER BY t.name`,
      );
    }

    res.json({
      success: true,
      data: result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        sessionCount: row.session_count,
      })),
    });
  } catch (error) {
    console.error('[Review Queue] Tags error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to load tags',
      },
    });
  }
});

/**
 * POST /sessions/:sessionId/assign
 * Assign a session to a specific reviewer. Creates a pending review with 24h expiration.
 */
router.post(
  '/sessions/:sessionId/assign',
  requireReviewAssign,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { reviewerId } = req.body;

      if (!reviewerId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'reviewerId is required',
          },
        });
      }

      await assignSession(sessionId, reviewerId, req.user!.id);

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign session';
      const status = message.includes('already has') ? 409 : 500;
      console.error('[Review Queue] Assign error:', error);
      res.status(status).json({
        success: false,
        error: {
          code: status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR',
          message,
        },
      });
    }
  },
);

export default router;
