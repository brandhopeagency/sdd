import { Router, Request, Response } from 'express';
import {
  reviewAuth,
  requireReviewAccess,
  requireTagAssignSession,
} from '../middleware/reviewAuth';
import {
  listSessionTags,
  addSessionTag,
  removeSessionTag,
} from '../services/sessionTag.service';

const router = Router();
router.use(...reviewAuth);

/**
 * GET /:sessionId/tags
 * List all tags for a session.
 * Requires: REVIEW_ACCESS permission
 */
router.get(
  '/:sessionId/tags',
  requireReviewAccess,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const tags = await listSessionTags(sessionId);

      res.json({ success: true, data: tags });
    } catch (error) {
      console.error('[Review SessionTags] Error listing session tags:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list session tags' },
      });
    }
  },
);

/**
 * POST /:sessionId/tags
 * Add a tag to a session.
 * Body: { tagDefinitionId: string } OR { tagName: string }
 * Requires: TAG_ASSIGN_SESSION permission
 */
router.post(
  '/:sessionId/tags',
  requireTagAssignSession,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { tagDefinitionId, tagName } = req.body;

      if (!tagDefinitionId && !tagName) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Either tagDefinitionId or tagName must be provided',
          },
        });
      }

      const userId = req.user?.id || req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const payload: { tagDefinitionId?: string; tagName?: string } = {};
      if (tagDefinitionId) payload.tagDefinitionId = tagDefinitionId;
      else if (tagName) payload.tagName = tagName;

      const result = await addSessionTag(sessionId, payload, userId);

      res.status(201).json({ success: true, data: result });
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
      console.error('[Review SessionTags] Error adding session tag:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to add session tag' },
      });
    }
  },
);

/**
 * DELETE /:sessionId/tags/:tagId
 * Remove a tag from a session.
 * Requires: TAG_ASSIGN_SESSION permission
 * Note: tagId here is the tag_definition_id (matching the frontend API client pattern)
 */
router.delete(
  '/:sessionId/tags/:tagId',
  requireTagAssignSession,
  async (req: Request, res: Response) => {
    try {
      const { sessionId, tagId } = req.params;

      const userId = req.user?.id || req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      await removeSessionTag(sessionId, tagId, userId);

      res.json({ success: true, data: { removed: true } });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
      }
      if (error.statusCode === 403) {
        return res.status(403).json({
          success: false,
          error: { code: 'SYSTEM_TAG', message: error.message },
        });
      }
      console.error('[Review SessionTags] Error removing session tag:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove session tag' },
      });
    }
  },
);

export default router;
