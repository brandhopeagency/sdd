import { Router, Request, Response } from 'express';
import { reviewAuth, requireTagManage, requireTagCreate } from '../middleware/reviewAuth';
import {
  listTagDefinitions,
  getTagDefinition,
  createTagDefinition,
  updateTagDefinition,
  deleteTagDefinition,
} from '../services/tagDefinition.service';

const router = Router();
router.use(...reviewAuth);

/**
 * GET /api/admin/tags
 * List tag definitions with optional category and active filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const activeRaw = req.query.active as string | undefined;

    const params: { category?: 'user' | 'chat'; active?: boolean } = {};

    if (category === 'user' || category === 'chat') {
      params.category = category;
    }

    if (activeRaw === 'true') {
      params.active = true;
    } else if (activeRaw === 'false') {
      params.active = false;
    }

    const tags = await listTagDefinitions(params);
    res.json({ success: true, data: tags });
  } catch (error) {
    console.error('[Admin Tags] Error listing tags:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list tags' },
    });
  }
});

/**
 * POST /api/admin/tags
 * Create a new tag definition
 * Requires: tag:manage permission
 */
router.post('/', requireTagCreate, async (req: Request, res: Response) => {
  try {
    const { name, description, category, excludeFromReviews } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'name is required' },
      });
    }

    if (!category || (category !== 'user' && category !== 'chat')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'category must be "user" or "chat"' },
      });
    }

    const userId = req.user?.id || req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
    }

    const tag = await createTagDefinition(
      { name: name.trim(), description, category, excludeFromReviews },
      userId,
    );

    res.status(201).json({ success: true, data: tag });
  } catch (error: any) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: error.message },
      });
    }
    console.error('[Admin Tags] Error creating tag:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create tag' },
    });
  }
});

/**
 * PUT /api/admin/tags/:id
 * Update a tag definition
 * Requires: tag:manage permission
 */
router.put('/:id', requireTagManage, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, excludeFromReviews, isActive } = req.body;

    const userId = req.user?.id || req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
    }

    const input: { name?: string; description?: string; excludeFromReviews?: boolean; isActive?: boolean } = {};
    if (name !== undefined) input.name = typeof name === 'string' ? name.trim() : name;
    if (description !== undefined) input.description = description;
    if (excludeFromReviews !== undefined) input.excludeFromReviews = excludeFromReviews;
    if (isActive !== undefined) input.isActive = isActive;

    const tag = await updateTagDefinition(id, input, userId);
    res.json({ success: true, data: tag });
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: error.message },
      });
    }
    console.error('[Admin Tags] Error updating tag:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update tag' },
    });
  }
});

/**
 * DELETE /api/admin/tags/:id
 * Delete a tag definition
 * Requires: tag:manage permission
 */
router.delete('/:id', requireTagManage, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userId = req.user?.id || req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
    }

    const result = await deleteTagDefinition(id, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    console.error('[Admin Tags] Error deleting tag:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete tag' },
    });
  }
});

export default router;
