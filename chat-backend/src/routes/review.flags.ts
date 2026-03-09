import { Router, Request, Response } from 'express';
import {
  reviewAuth,
  requireReviewAccess,
  requireReviewFlag,
  requireReviewEscalation,
} from '../middleware/reviewAuth';
import {
  createFlag,
  listFlagsForSession,
  resolveFlag,
  listEscalations,
} from '../services/riskFlag.service';

const router = Router();
router.use(...reviewAuth);

// ── Routes ──

/**
 * GET /:sessionId/flags
 * List all risk flags for a session.
 * (Mounted at /api/review/sessions → full path: /api/review/sessions/:sessionId/flags)
 */
router.get(
  '/:sessionId/flags',
  requireReviewAccess,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const flags = await listFlagsForSession(sessionId);

      res.json({ success: true, data: flags });
    } catch (error) {
      console.error('[Review Flags] Error listing flags:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list flags' },
      });
    }
  },
);

/**
 * POST /:sessionId/flags
 * Create a new risk flag on a session.
 * (Mounted at /api/review/sessions → full path: /api/review/sessions/:sessionId/flags)
 */
router.post(
  '/:sessionId/flags',
  requireReviewFlag,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const flaggedBy = req.user?.id;
      const {
        severity,
        reasonCategory,
        details,
        requestDeanonymization,
        deanonymizationJustification,
      } = req.body || {};

      // Validation
      if (!severity || !['high', 'medium', 'low'].includes(severity)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Valid severity is required (high, medium, low)' },
        });
      }

      if (!reasonCategory) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Reason category is required' },
        });
      }

      if (!details || details.length < 10) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Details must be at least 10 characters' },
        });
      }

      if (requestDeanonymization && (!deanonymizationJustification || deanonymizationJustification.length < 10)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Deanonymization justification required (min 10 characters)' },
        });
      }

      const flag = await createFlag({
        sessionId,
        flaggedBy: flaggedBy ?? null,
        severity,
        reasonCategory,
        details,
        deanonymizationRequested: requestDeanonymization ?? false,
        isAutoDetected: false,
      });

      res.status(201).json({ success: true, data: flag });
    } catch (error: any) {
      console.error('[Review Flags] Error creating flag:', error);
      const statusCode = error.statusCode || 500;
      const code = error.code || 'INTERNAL_ERROR';
      const message = error.message || 'Failed to create flag';
      res.status(statusCode).json({ success: false, error: { code, message } });
    }
  },
);

/**
 * POST /:sessionId/flags/:flagId/resolve
 * Resolve, acknowledge, or escalate a flag.
 * (Mounted at /api/review/sessions → full path: /api/review/sessions/:sessionId/flags/:flagId/resolve)
 */
router.post(
  '/:sessionId/flags/:flagId/resolve',
  requireReviewEscalation,
  async (req: Request, res: Response) => {
    try {
      const { flagId } = req.params;
      const resolvedBy = req.user?.id;
      const { resolutionNotes, newStatus } = req.body || {};

      if (!resolvedBy) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      if (!newStatus || !['acknowledged', 'resolved', 'escalated'].includes(newStatus)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Valid newStatus is required (acknowledged, resolved, escalated)' },
        });
      }

      if (newStatus === 'resolved' && (!resolutionNotes || resolutionNotes.length < 5)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Resolution notes required when resolving a flag' },
        });
      }

      const flag = await resolveFlag(flagId, resolvedBy, {
        resolutionNotes: resolutionNotes ?? '',
        newStatus,
      });

      res.json({ success: true, data: flag });
    } catch (error: any) {
      console.error('[Review Flags] Error resolving flag:', error);
      const statusCode = error.statusCode || 500;
      const code = error.code || 'INTERNAL_ERROR';
      const message = error.message || 'Failed to resolve flag';
      res.status(statusCode).json({ success: false, error: { code, message } });
    }
  },
);

/**
 * GET /escalations
 * List the escalation queue with optional filters and pagination.
 */
router.get(
  '/escalations',
  requireReviewEscalation,
  async (req: Request, res: Response) => {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
      const severity = req.query.severity as string | undefined;
      const status = req.query.status as string | undefined;

      const result = await listEscalations({ page, pageSize, severity, status });

      res.json({
        success: true,
        data: {
          items: result.data,
          total: result.total,
          highOpen: result.highOpen,
          mediumOpen: result.mediumOpen,
          overdueSla: result.overdueSla,
          page,
          pageSize,
        },
      });
    } catch (error) {
      console.error('[Review Flags] Error listing escalations:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list escalations' },
      });
    }
  },
);

export default router;
