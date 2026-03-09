import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount, requirePermission } from '../middleware/auth';
import { Permission } from '../types';
import { listTags } from '../services/sessionModeration.service';

const router = Router();

router.use(authenticate);
router.use(requireActiveAccount);
router.use(requirePermission(Permission.WORKBENCH_RESEARCH));

/**
 * GET /api/admin/tags
 * List tag definitions (optionally filter by category)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const categoryRaw = (req.query.category as string) || '';
    const category =
      categoryRaw === 'session' || categoryRaw === 'message'
        ? (categoryRaw as 'session' | 'message')
        : undefined;
    const tags = await listTags(category);
    res.json({ success: true, data: tags });
  } catch (error) {
    console.error('[Admin Tags] Error listing tags:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list tags' }
    });
  }
});

export default router;

