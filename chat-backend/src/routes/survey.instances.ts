import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount, requirePermission, requireAnyPermission } from '../middleware/auth';
import { workbenchGuard } from '../middleware/workbenchGuard';
import { Permission } from '../types';
import {
  createInstance,
  getInstanceById,
  listInstances,
  closeInstance,
  getResponsesForInstance,
} from '../services/surveyInstance.service';
import {
  invalidateInstanceResponses,
  invalidateGroupResponses,
} from '../services/surveyResponse.service';
import { exportResponses } from '../services/surveyExport.service';

const router = Router();
router.use(authenticate, requireActiveAccount, workbenchGuard);

router.get(
  '/',
  requireAnyPermission(Permission.SURVEY_INSTANCE_MANAGE, Permission.SURVEY_INSTANCE_VIEW),
  async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const schemaId = req.query.schemaId as string | undefined;
      const instances = await listInstances(status, schemaId);
      res.json({ success: true, data: instances });
    } catch (error: any) {
      console.error('[Survey Instances] Error listing:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list instances' } });
    }
  },
);

router.post('/', requirePermission(Permission.SURVEY_INSTANCE_MANAGE), async (req: Request, res: Response) => {
  try {
    const { schemaId, groupIds, addToMemory, startDate, expirationDate, publicHeader, showReview } = req.body;
    const instance = await createInstance(
      schemaId,
      groupIds,
      !!addToMemory,
      startDate,
      expirationDate,
      req.user!.id,
      publicHeader,
      showReview,
    );
    res.status(201).json({ success: true, data: instance });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Instances] Error creating:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create instance' } });
  }
});

router.get(
  '/:id/responses/download',
  requirePermission(Permission.SURVEY_RESPONSE_VIEW),
  async (req: Request, res: Response) => {
    try {
      const groupId = req.query.groupId as string | undefined;
      const format = req.query.format as string | undefined;
      if (!groupId || !format || (format !== 'json' && format !== 'csv')) {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'groupId and format (json or csv) are required' } });
      }
      const result = await exportResponses(req.params.id, groupId, format as 'json' | 'csv');
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
      }
      console.error('[Survey Instances] Error downloading responses:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to download responses' } });
    }
  },
);

router.get(
  '/:id',
  requireAnyPermission(Permission.SURVEY_INSTANCE_MANAGE, Permission.SURVEY_INSTANCE_VIEW),
  async (req: Request, res: Response) => {
    try {
      const instance = await getInstanceById(req.params.id);
      if (!instance) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Instance not found' } });
      res.json({ success: true, data: instance });
    } catch (error: any) {
      console.error('[Survey Instances] Error getting:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get instance' } });
    }
  },
);

router.post('/:id/close', requirePermission(Permission.SURVEY_INSTANCE_MANAGE), async (req: Request, res: Response) => {
  try {
    const instance = await closeInstance(req.params.id);
    res.json({ success: true, data: instance });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Instances] Error closing:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to close instance' } });
  }
});

router.get(
  '/:id/responses',
  requirePermission(Permission.SURVEY_RESPONSE_VIEW),
  async (req: Request, res: Response) => {
    try {
      const responses = await getResponsesForInstance(req.params.id);
      res.json({ success: true, data: responses });
    } catch (error: any) {
      console.error('[Survey Instances] Error listing responses:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list responses' } });
    }
  },
);

router.post(
  '/:id/invalidate',
  requirePermission(Permission.SURVEY_INSTANCE_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
      const result = await invalidateInstanceResponses({ instanceId: req.params.id, actorId: req.user!.id, reason });
      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
      }
      console.error('[Survey Instances] Error invalidating instance:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to invalidate instance responses' } });
    }
  },
);

router.post(
  '/:id/invalidate-group',
  requirePermission(Permission.SURVEY_INSTANCE_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const groupId = req.body?.groupId;
      if (!groupId || typeof groupId !== 'string') {
        return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'groupId is required' } });
      }
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
      const result = await invalidateGroupResponses({ instanceId: req.params.id, groupId, actorId: req.user!.id, reason });
      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
      }
      console.error('[Survey Instances] Error invalidating group:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to invalidate group responses' } });
    }
  },
);

export default router;
