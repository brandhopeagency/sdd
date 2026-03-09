import { Router, Request, Response } from 'express';
import {
  reviewAuth,
  requireReviewSupervise,
} from '../middleware/reviewAuth';
import {
  getSupervisionQueue,
  getSupervisionContext,
  submitDecision,
  getAwaitingFeedback,
} from '../services/supervision.service';

const router = Router();
router.use(...reviewAuth);

// GET /api/review/supervision/queue — list reviews pending supervision
router.get('/queue', requireReviewSupervise, async (req: Request, res: Response) => {
  try {
    const items = await getSupervisionQueue();
    res.json({ success: true, data: items });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// GET /api/review/supervision/:sessionReviewId — get full context for supervision
router.get('/:sessionReviewId', requireReviewSupervise, async (req: Request, res: Response) => {
  try {
    const context = await getSupervisionContext(req.params.sessionReviewId);
    res.json({ success: true, data: context });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// POST /api/review/supervision/:sessionReviewId/decision — submit supervisor decision
router.post('/:sessionReviewId/decision', requireReviewSupervise, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { decision, comments, returnToReviewer } = req.body;

    if (!decision || !['approved', 'disapproved'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'decision must be "approved" or "disapproved"' },
      });
    }
    if (!comments || typeof comments !== 'string' || comments.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'comments are required' },
      });
    }

    const result = await submitDecision(req.params.sessionReviewId, user.id, {
      decision,
      comments: comments.trim(),
      returnToReviewer: returnToReviewer === true,
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// GET /api/review/supervision/awaiting/:reviewerId — reviews awaiting feedback
router.get('/awaiting/:reviewerId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.id !== req.params.reviewerId && !user.permissions?.includes('review:supervise')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Can only view own awaiting feedback' },
      });
    }
    const items = await getAwaitingFeedback(req.params.reviewerId);
    res.json({ success: true, data: items });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
});

export default router;
