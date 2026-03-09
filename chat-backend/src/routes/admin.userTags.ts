import { Router, Request, Response } from 'express';
import { reviewAuth, requireTagAssignUser } from '../middleware/reviewAuth';
import {
  listUserTags,
  assignUserTag,
  removeUserTag,
} from '../services/userTag.service';

const router = Router();

// All routes require reviewAuth base + TAG_ASSIGN_USER permission
router.use(...reviewAuth);
router.use(requireTagAssignUser);

/**
 * GET /api/admin/users/:userId/tags
 * List all tags assigned to a user
 */
router.get('/:userId/tags', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const tags = await listUserTags(userId);
    res.json({ success: true, data: tags });
  } catch (error) {
    console.error('[Admin UserTags] Error listing user tags:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list user tags' },
    });
  }
});

/**
 * POST /api/admin/users/:userId/tags
 * Assign a tag to a user
 * Body: { tagDefinitionId: string }
 */
router.post('/:userId/tags', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { tagDefinitionId } = req.body;

    if (!tagDefinitionId || typeof tagDefinitionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'tagDefinitionId is required' },
      });
    }

    const actorId = req.user?.id || req.userId;
    if (!actorId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
    }

    const userTag = await assignUserTag(userId, tagDefinitionId, actorId);
    res.status(201).json({ success: true, data: userTag });
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: { code: error.code || 'INVALID_REQUEST', message: error.message },
      });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: error.message },
      });
    }
    console.error('[Admin UserTags] Error assigning user tag:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to assign user tag' },
    });
  }
});

/**
 * DELETE /api/admin/users/:userId/tags/:tagId
 * Remove a tag from a user
 * :tagId is the tag_definition_id
 */
router.delete('/:userId/tags/:tagId', async (req: Request, res: Response) => {
  try {
    const { userId, tagId } = req.params;

    const actorId = req.user?.id || req.userId;
    if (!actorId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
    }

    await removeUserTag(userId, tagId, actorId);
    res.json({ success: true, data: { removed: true } });
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    console.error('[Admin UserTags] Error removing user tag:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove user tag' },
    });
  }
});

export default router;
