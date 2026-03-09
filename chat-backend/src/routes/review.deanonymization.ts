import { Router, Request, Response } from 'express';
import {
  reviewAuth,
  requireReviewDeanonymizeRequest,
  requireReviewDeanonymizeApprove,
} from '../middleware/reviewAuth';
import {
  createRequest,
  listRequests,
  approveRequest,
  denyRequest,
  getRevealedIdentity,
} from '../services/deanonymization.service';
import { getPool } from '../db';
import { Permission } from '@mentalhelpglobal/chat-types';

const router = Router();
router.use(...reviewAuth);

// ── GET / ──
// List deanonymization requests with optional filters.
// Commanders (REVIEW_DEANONYMIZE_APPROVE) see all requests.
// Regular reviewers only see their own requests.
router.get(
  '/',
  requireReviewDeanonymizeRequest,
  async (req: Request, res: Response) => {
    try {
      const { status, page, pageSize, limit } = req.query;

      // If user doesn't have approve permission, restrict to their own requests
      const isApprover = req.user?.permissions?.includes(Permission.REVIEW_DEANONYMIZE_APPROVE);
      const requesterId = isApprover ? undefined : req.user?.id;

      const result = await listRequests({
        status: status as string | undefined,
        requesterId,
        page: page ? Number(page) : undefined,
        pageSize: (pageSize ? Number(pageSize) : limit ? Number(limit) : undefined) ?? 20,
      });

      res.json({
        success: true,
        data: {
          items: result.data,
          total: result.total,
        },
      });
    } catch (error) {
      console.error('[Deanonymization] Error listing requests:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list deanonymization requests',
        },
      });
    }
  },
);

// ── POST / ──
// Create a new deanonymization request.
router.post(
  '/',
  requireReviewDeanonymizeRequest,
  async (req: Request, res: Response) => {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const { sessionId, justificationCategory, justificationDetails, riskFlagId, flagId } = req.body || {};

      if (!sessionId || !justificationCategory || !justificationDetails) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'sessionId, justificationCategory, and justificationDetails are required',
          },
        });
      }

      if (justificationDetails.length < 20) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Justification details must be at least 20 characters',
          },
        });
      }

      // Look up the target user's real ID from the session
      const pool = getPool();
      const sessionResult = await pool.query(
        'SELECT user_id FROM sessions WHERE id = $1',
        [sessionId],
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Session not found' },
        });
      }

      const targetUserId = sessionResult.rows[0].user_id;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_USER',
            message: 'Session has no associated user',
          },
        });
      }

      const request = await createRequest({
        sessionId,
        targetUserId,
        requesterId,
        riskFlagId: riskFlagId ?? flagId ?? null,
        justificationCategory,
        justificationDetails,
      });

      res.status(201).json({
        success: true,
        data: request,
      });
    } catch (error: any) {
      console.error('[Deanonymization] Error creating request:', error);
      const statusCode = error.statusCode || 500;
      const code = error.code || 'INTERNAL_ERROR';
      const message = error.message || 'Failed to create deanonymization request';
      res.status(statusCode).json({
        success: false,
        error: { code, message },
      });
    }
  },
);

// ── POST /:requestId/approve ──
// Commander approval of a deanonymization request.
router.post(
  '/:requestId/approve',
  requireReviewDeanonymizeApprove,
  async (req: Request, res: Response) => {
    try {
      const approverId = req.user?.id;
      if (!approverId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const { requestId } = req.params;
      const { accessDurationHours } = req.body || {};

      const updated = await approveRequest(
        requestId,
        approverId,
        accessDurationHours ? Number(accessDurationHours) : undefined,
      );

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      console.error('[Deanonymization] Error approving request:', error);
      const statusCode = error.statusCode || 500;
      const code = error.code || 'INTERNAL_ERROR';
      const message = error.message || 'Failed to approve deanonymization request';
      res.status(statusCode).json({
        success: false,
        error: { code, message },
      });
    }
  },
);

// ── POST /:requestId/deny ──
// Commander denial of a deanonymization request.
router.post(
  '/:requestId/deny',
  requireReviewDeanonymizeApprove,
  async (req: Request, res: Response) => {
    try {
      const approverId = req.user?.id;
      if (!approverId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const { requestId } = req.params;
      const { denialNotes } = req.body || {};

      if (!denialNotes) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'denialNotes is required when denying a request',
          },
        });
      }

      const updated = await denyRequest(requestId, approverId, denialNotes);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      console.error('[Deanonymization] Error denying request:', error);
      const statusCode = error.statusCode || 500;
      const code = error.code || 'INTERNAL_ERROR';
      const message = error.message || 'Failed to deny deanonymization request';
      res.status(statusCode).json({
        success: false,
        error: { code, message },
      });
    }
  },
);

// ── GET /:requestId/identity ──
// Get revealed identity for an approved request (time-limited).
// Only the original requester or a commander (REVIEW_DEANONYMIZE_APPROVE) can reveal.
router.get(
  '/:requestId/identity',
  requireReviewDeanonymizeRequest,
  async (req: Request, res: Response) => {
    try {
      const accessorId = req.user?.id;
      if (!accessorId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const { requestId } = req.params;

      // Verify the accessor is the original requester or a commander
      const pool = getPool();
      const reqCheck = await pool.query(
        'SELECT requester_id FROM deanonymization_requests WHERE id = $1',
        [requestId],
      );

      if (reqCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Request not found' },
        });
      }

      const isApprover = req.user?.permissions?.includes(Permission.REVIEW_DEANONYMIZE_APPROVE);
      const isOriginalRequester = reqCheck.rows[0].requester_id === accessorId;

      if (!isOriginalRequester && !isApprover) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Only the original requester or a commander can reveal identity',
          },
        });
      }

      const identity = await getRevealedIdentity(requestId, accessorId);

      if (!identity) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied — request is not approved or access has expired',
          },
        });
      }

      res.json({
        success: true,
        data: identity,
      });
    } catch (error: any) {
      console.error('[Deanonymization] Error getting identity:', error);
      const statusCode = error.statusCode || 500;
      const code = error.code || 'INTERNAL_ERROR';
      const message = error.message || 'Failed to retrieve identity';
      res.status(statusCode).json({
        success: false,
        error: { code, message },
      });
    }
  },
);

export default router;
