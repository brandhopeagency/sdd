import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount } from '../middleware/auth';
import {
  getGateCheck,
  createOrUpdateResponse,
  getResponseByInstance,
  savePartialProgress,
} from '../services/surveyResponse.service';

const router = Router();
router.use(authenticate, requireActiveAccount);

function getUserContext(req: Request) {
  const user = req.user!;
  const memberships = user.memberships ?? [];
  const userGroupIds = memberships
    .filter(m => m.status === 'active')
    .map(m => m.groupId);
  // Current "effective" group context, if the auth layer provides it.
  // Used to disambiguate users with multiple active group memberships.
  const activeGroupId =
    (user as any).activeGroupId ??
    (user as any).active_group_id ??
    (user as any).activeGroup?.id ??
    null;
  const pseudonymousId = (user as any).pseudonymousId ?? user.id;
  return { userGroupIds, activeGroupId, pseudonymousId };
}

router.get('/gate-check', async (req: Request, res: Response) => {
  try {
    const { userGroupIds, pseudonymousId } = getUserContext(req);
    const pending = await getGateCheck(userGroupIds, pseudonymousId);
    res.json({ success: true, data: pending });
  } catch (error: any) {
    console.error('[Survey Gate] Error checking gate:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check survey gate' } });
  }
});

router.get('/survey-responses/:instanceId', async (req: Request, res: Response) => {
  try {
    const { pseudonymousId } = getUserContext(req);
    const response = await getResponseByInstance(req.params.instanceId, pseudonymousId);
    if (!response) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Response not found' } });
    res.json({ success: true, data: response });
  } catch (error: any) {
    console.error('[Survey Gate] Error getting response:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get response' } });
  }
});

router.post('/survey-responses', async (req: Request, res: Response) => {
  try {
    const { userGroupIds, activeGroupId, pseudonymousId } = getUserContext(req);
    const { instanceId, answers, isComplete } = req.body;
    if (!instanceId || typeof instanceId !== 'string') {
      return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'instanceId is required' } });
    }
    const response = await createOrUpdateResponse(
      instanceId,
      pseudonymousId,
      userGroupIds,
      activeGroupId,
      answers ?? [],
      isComplete ?? false,
    );
    res.status(201).json({ success: true, data: response });
  } catch (error: any) {
    if (error.statusCode) {
      const errorResponse: any = { success: false, error: { code: error.code || 'VALIDATION_ERROR', message: error.message } };
      if (error.details) errorResponse.error.details = error.details;
      return res.status(error.statusCode).json(errorResponse);
    }
    console.error('[Survey Gate] Error creating response:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create response' } });
  }
});

router.patch('/survey-responses/:id', async (req: Request, res: Response) => {
  try {
    const { pseudonymousId } = getUserContext(req);
    const { answers } = req.body;
    const response = await savePartialProgress(req.params.id, pseudonymousId, answers ?? []);
    res.json({ success: true, data: response });
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: { code: error.code || 'ERROR', message: error.message } });
    }
    console.error('[Survey Gate] Error saving partial:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save partial progress' } });
  }
});

export default router;
