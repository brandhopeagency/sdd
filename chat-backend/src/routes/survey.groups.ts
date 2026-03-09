import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount, requirePermission } from '../middleware/auth';
import { workbenchGuard } from '../middleware/workbenchGuard';
import { Permission } from '../types';
import { getGroupSurveyOrder, updateGroupSurveyOrder } from '../services/groupSurveyOrder.service';

const router = Router({ mergeParams: true });
router.use(authenticate, requireActiveAccount, workbenchGuard);

router.get(
  '/',
  requirePermission(Permission.SURVEY_INSTANCE_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const surveys = await getGroupSurveyOrder(req.params.groupId);
      res.json({ success: true, data: surveys });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
      }
      console.error('[Survey Groups] Error listing surveys:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list group surveys' } });
    }
  },
);

router.put(
  '/order',
  requirePermission(Permission.SURVEY_INSTANCE_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const { instanceIds } = req.body;
      if (!Array.isArray(instanceIds) || instanceIds.length === 0 || !instanceIds.every((id: unknown) => typeof id === 'string')) {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'instanceIds must be a non-empty array of strings' } });
      }
      await updateGroupSurveyOrder(req.params.groupId, instanceIds);
      res.json({ success: true });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
      }
      console.error('[Survey Groups] Error updating order:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update group survey order' } });
    }
  },
);

export default router;
