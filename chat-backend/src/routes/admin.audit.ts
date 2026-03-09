import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount, requirePermission, getClientIp } from '../middleware/auth';
import { Permission } from '../types';
import { logAuditEvent } from '../services/auth.service';

const router = Router();

// All routes require auth + active account
router.use(authenticate);
router.use(requireActiveAccount);

/**
 * POST /api/admin/audit/pii-reveal
 * Minimal audit trail for PII reveal actions.
 *
 * IMPORTANT: Do not log actual PII values.
 */
router.post('/pii-reveal', requirePermission(Permission.DATA_VIEW_PII), async (req: Request, res: Response) => {
  try {
    const context = typeof req.body?.context === 'string' ? req.body.context : 'workbench';
    const path = typeof req.body?.path === 'string' ? req.body.path : undefined;
    const visible = typeof req.body?.visible === 'boolean' ? req.body.visible : true;

    await logAuditEvent(req.userId || null, 'pii.reveal', 'pii', null, { context, path, visible }, getClientIp(req));

    res.json({ success: true, data: { ok: true } });
  } catch (error) {
    console.error('[Audit] Error logging pii reveal:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to log audit event' }
    });
  }
});

export default router;

