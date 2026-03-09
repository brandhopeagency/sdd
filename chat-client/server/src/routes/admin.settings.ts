import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount } from '../middleware/auth';
import { UserRole } from '../types';
import { getSettings, updateSettings } from '../services/settings.service';

const router = Router();

router.use(authenticate);
router.use(requireActiveAccount);

function requireOwner(req: Request, res: Response): boolean {
  if (req.user?.role !== UserRole.OWNER) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owners can manage settings' }
    });
    return false;
  }
  return true;
}

/**
 * GET /api/admin/settings
 * Owner-only settings.
 */
router.get('/', async (req: Request, res: Response) => {
  if (!requireOwner(req, res)) return;
  try {
    const settings = await getSettings(true);
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('[Settings] Error loading settings:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load settings' }
    });
  }
});

/**
 * PATCH /api/admin/settings
 * Owner-only settings update.
 */
router.patch('/', async (req: Request, res: Response) => {
  if (!requireOwner(req, res)) return;
  try {
    const guestModeEnabled =
      typeof req.body?.guestModeEnabled === 'boolean' ? req.body.guestModeEnabled : undefined;
    const approvalCooloffDays =
      typeof req.body?.approvalCooloffDays === 'number' ? req.body.approvalCooloffDays : undefined;

    if (approvalCooloffDays !== undefined) {
      const rounded = Math.round(approvalCooloffDays);
      if (!Number.isFinite(rounded) || rounded < 0 || rounded > 365) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'approvalCooloffDays must be 0-365' }
        });
      }
    }

    const updated = await updateSettings({
      ...(guestModeEnabled !== undefined ? { guestModeEnabled } : {}),
      ...(approvalCooloffDays !== undefined ? { approvalCooloffDays } : {})
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Settings] Error updating settings:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update settings' }
    });
  }
});

export default router;

