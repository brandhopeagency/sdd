import { Router, Request, Response } from 'express';
import { getPublicSettings } from '../services/settings.service';

const router = Router();

/**
 * GET /api/settings
 * Public settings needed for client gating.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await getPublicSettings();
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('[Settings] Error loading public settings:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load settings' }
    });
  }
});

export default router;

