import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount, requirePermission } from '../middleware/auth';
import { workbenchGuard } from '../middleware/workbenchGuard';
import { Permission } from '../types';
import { invalidateResponseById } from '../services/surveyResponse.service';

const router = Router();
router.use(authenticate, requireActiveAccount, workbenchGuard);

router.post('/:id/invalidate', requirePermission(Permission.SURVEY_INSTANCE_MANAGE), async (req: Request, res: Response) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const result = await invalidateResponseById({ responseId: req.params.id, actorId: req.user!.id, reason });
    if (!result.affected) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Response not found' } });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Responses] Error invalidating response:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to invalidate response' } });
  }
});

export default router;

