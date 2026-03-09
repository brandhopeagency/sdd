import { Router, Request, Response } from 'express';
import { authenticate, requirePermission, requireActiveAccount } from '../middleware/auth';
import { Permission } from '../types';
import { maskPIIInUnknown } from '../utils/piiMasking';
import {
  addSessionTag,
  createSessionAnnotation,
  getAdminSessionById,
  getAdminSessionsStats,
  getSessionConversationForAdmin,
  listAdminSessions,
  listSessionAnnotations,
  removeSessionTag,
  updateSessionModerationStatus
} from '../services/sessionModeration.service';
import { expireOldSessions } from '../services/session.service';

const router = Router();

// All routes require auth + active account
router.use(authenticate);
router.use(requireActiveAccount);

function canViewPii(req: Request): boolean {
  return req.user?.permissions.includes(Permission.DATA_VIEW_PII) ?? false;
}

/**
 * GET /api/admin/sessions
 * List sessions for research/moderation
 */
router.get('/', requirePermission(Permission.WORKBENCH_RESEARCH), async (req: Request, res: Response) => {
  try {
    const pageRaw = parseInt(req.query.page as string);
    const limitRaw = parseInt(req.query.limit as string);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20;
    const search = (req.query.search as string) || '';
    const statusRaw = (req.query.status as string) || 'all';
    const moderationStatusRaw = (req.query.moderationStatus as string) || 'all';
    const dateFromRaw = (req.query.dateFrom as string) || undefined;
    const dateToRaw = (req.query.dateTo as string) || undefined;

    const statusAllowed = ['active', 'ended', 'expired', 'all'] as const;
    const moderationAllowed = ['pending', 'in_review', 'moderated', 'all'] as const;

    const status = (statusAllowed as readonly string[]).includes(statusRaw) ? (statusRaw as any) : 'all';
    const moderationStatus = (moderationAllowed as readonly string[]).includes(moderationStatusRaw)
      ? (moderationStatusRaw as any)
      : 'all';

    if (dateFromRaw) {
      const d = new Date(dateFromRaw);
      if (!Number.isFinite(d.getTime())) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Invalid dateFrom' }
        });
      }
    }

    if (dateToRaw) {
      const d = new Date(dateToRaw);
      if (!Number.isFinite(d.getTime())) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Invalid dateTo' }
        });
      }
    }

    const result = await listAdminSessions({
      page,
      limit,
      search,
      status,
      moderationStatus,
      dateFrom: dateFromRaw,
      dateTo: dateToRaw
    }, { includePiiSearch: canViewPii(req) });

    const sessions = canViewPii(req)
      ? result.sessions
      : result.sessions.map((s) => ({ ...s, userName: null }));

    res.json({
      success: true,
      data: sessions,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore
      }
    });
  } catch (error) {
    console.error('[Admin Sessions] Error listing sessions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list sessions'
      }
    });
  }
});

/**
 * GET /api/admin/sessions/stats
 * Dashboard-friendly aggregate counts (not paginated).
 */
router.get('/stats', requirePermission(Permission.WORKBENCH_RESEARCH), async (_req: Request, res: Response) => {
  try {
    const stats = await getAdminSessionsStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[Admin Sessions] Error getting stats:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get sessions stats' }
    });
  }
});

/**
 * POST /api/admin/sessions/expire
 * Expire inactive sessions by timeout (default 30 minutes).
 * Intended for Cloud Scheduler / manual maintenance.
 */
router.post('/expire', requirePermission(Permission.WORKBENCH_USER_MANAGEMENT), async (req: Request, res: Response) => {
  try {
    const maxAgeMinutesRaw = req.body?.maxAgeMinutes;
    const maxAgeMinutes =
      typeof maxAgeMinutesRaw === 'number' && Number.isFinite(maxAgeMinutesRaw) && maxAgeMinutesRaw > 0
        ? Math.floor(maxAgeMinutesRaw)
        : 30;

    const expiredCount = await expireOldSessions(maxAgeMinutes);
    return res.json({
      success: true,
      data: { expiredCount, maxAgeMinutes }
    });
  } catch (error) {
    console.error('[Admin Sessions] Error expiring old sessions:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to expire old sessions' }
    });
  }
});

/**
 * GET /api/admin/sessions/:id
 * Get session details (metadata + tags + moderation status)
 */
router.get('/:id', requirePermission(Permission.WORKBENCH_RESEARCH), async (req: Request, res: Response) => {
  try {
    const session = await getAdminSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      });
    }

    const data = canViewPii(req) ? session : { ...session, userName: null };
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Admin Sessions] Error getting session:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get session' }
    });
  }
});

/**
 * GET /api/admin/sessions/:id/conversation
 * Get full conversation (from GCS if ended, from DB if active)
 */
router.get('/:id/conversation', requirePermission(Permission.WORKBENCH_RESEARCH), async (req: Request, res: Response) => {
  try {
    const conversation = await getSessionConversationForAdmin(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }

    const data = canViewPii(req) ? conversation : maskPIIInUnknown(conversation);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Admin Sessions] Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get conversation' }
    });
  }
});

/**
 * PATCH /api/admin/sessions/:id/moderation
 * Update moderation status
 */
router.patch('/:id/moderation', requirePermission(Permission.WORKBENCH_MODERATION), async (req: Request, res: Response) => {
  try {
    const moderationStatus = req.body?.moderationStatus;
    if (!moderationStatus || !['pending', 'in_review', 'moderated'].includes(moderationStatus)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid moderationStatus' }
      });
    }

    const updated = await updateSessionModerationStatus(req.params.id, moderationStatus);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Admin Sessions] Error updating moderation status:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update moderation status' }
    });
  }
});

/**
 * POST /api/admin/sessions/:id/tags
 * Add tag to session (creates tag if needed)
 */
router.post('/:id/tags', requirePermission(Permission.WORKBENCH_MODERATION), async (req: Request, res: Response) => {
  try {
    const tagName = (req.body?.tagName as string) || '';
    if (!tagName.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'tagName is required' }
      });
    }

    const updated = await addSessionTag(req.params.id, tagName, req.userId || null);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Admin Sessions] Error adding session tag:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to add tag' }
    });
  }
});

/**
 * DELETE /api/admin/sessions/:id/tags/:tagName
 * Remove tag from session
 */
router.delete('/:id/tags/:tagName', requirePermission(Permission.WORKBENCH_MODERATION), async (req: Request, res: Response) => {
  try {
    const tagName = decodeURIComponent(req.params.tagName);
    const updated = await removeSessionTag(req.params.id, tagName);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Admin Sessions] Error removing session tag:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove tag' }
    });
  }
});

/**
 * GET /api/admin/sessions/:id/annotations
 * List annotations for session
 */
router.get('/:id/annotations', requirePermission(Permission.WORKBENCH_RESEARCH), async (req: Request, res: Response) => {
  try {
    const annotations = await listSessionAnnotations(req.params.id);
    res.json({ success: true, data: annotations });
  } catch (error) {
    console.error('[Admin Sessions] Error listing annotations:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list annotations' }
    });
  }
});

/**
 * POST /api/admin/sessions/:id/annotations
 * Create annotation for session/message
 */
router.post('/:id/annotations', requirePermission(Permission.WORKBENCH_MODERATION), async (req: Request, res: Response) => {
  try {
    const { messageId, qualityRating, goldenReference, notes, tags } = req.body || {};

    if (!qualityRating || ![1, 2, 3, 4, 5].includes(qualityRating)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'qualityRating must be 1..5' }
      });
    }

    const created = await createSessionAnnotation({
      sessionId: req.params.id,
      messageId: messageId || null,
      authorId: req.userId || null,
      qualityRating,
      goldenReference: goldenReference || null,
      notes: notes || '',
      tags: Array.isArray(tags) ? tags : []
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('[Admin Sessions] Error creating annotation:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create annotation' }
    });
  }
});

export default router;

