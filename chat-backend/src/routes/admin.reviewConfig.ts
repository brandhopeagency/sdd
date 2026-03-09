import { Router, Request, Response } from 'express';
import { reviewAuth, requireReviewAccess, requireReviewConfigure, requireReviewSupervisionConfig } from '../middleware/reviewAuth';
import { getConfig, updateConfig } from '../services/reviewConfig.service';
import {
  getGroupReviewConfig,
} from '../services/supervision.service';
import { logAuditEvent } from '../services/auth.service';
import { getClientIp } from '../middleware/auth';
import { getPool } from '../db';

const router = Router();
router.use(...reviewAuth);

/**
 * GET /api/admin/review/config
 * Get current review configuration
 * Requires: review:access permission
 */
router.get('/config', requireReviewAccess, async (req: Request, res: Response) => {
  try {
    const config = await getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('[Review Config] GET error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load configuration' } });
  }
});

const VALIDATION = {
  minReviews: { min: 1, max: 10 },
  maxReviews: { min: 1, max: 10 },
  criteriaThreshold: { min: 1, max: 10 },
  autoFlagThreshold: { min: 1, max: 10 },
  varianceLimit: { min: 0.1, max: 9.9 },
  timeoutHours: { min: 1, max: 72 },
  highRiskSlaHours: { min: 1, max: 48 },
  mediumRiskSlaHours: { min: 1, max: 168 },
  deanonymizationAccessHours: { min: 1, max: 168 },
  minMessageThreshold: { min: 1, max: 100 },
} as const;

/**
 * PUT /api/admin/review/config
 * Update review configuration
 * Requires: review:configure permission (Owner only)
 * Audit logs the change
 */
router.put('/config', requireReviewConfigure, async (req: Request, res: Response) => {
  try {
    const updates = req.body;

    // Validate numeric fields with proper ranges
    for (const [field, range] of Object.entries(VALIDATION)) {
      const val = updates[field];
      if (val === undefined) continue;
      if (typeof val !== 'number' || isNaN(val)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: `${field} must be a number` } });
      }
      if (val < range.min || val > range.max) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: `${field} must be between ${range.min} and ${range.max}` } });
      }
    }

    // maxReviews must be >= minReviews
    const current = await getConfig();
    const effectiveMin = updates.minReviews ?? current.minReviews;
    const effectiveMax = updates.maxReviews ?? current.maxReviews;
    if (effectiveMax < effectiveMin) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'maxReviews must be >= minReviews' } });
    }
    
    // Validate supervision fields
    if (updates.supervisionPolicy !== undefined) {
      if (!['all', 'sampled', 'none'].includes(updates.supervisionPolicy)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'supervisionPolicy must be "all", "sampled", or "none"' } });
      }
    }
    if (updates.supervisionSamplePercentage !== undefined) {
      if (typeof updates.supervisionSamplePercentage !== 'number' || updates.supervisionSamplePercentage < 1 || updates.supervisionSamplePercentage > 100) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'supervisionSamplePercentage must be 1-100' } });
      }
    }

    const userId = req.user?.id || req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }
    
    const config = await updateConfig(updates, userId);
    
    // Audit log the configuration change (targetType per T001: 'review_config')
    await logAuditEvent(
      userId,
      'review.config.update',
      'review_config',
      '1',
      { updates },
      getClientIp(req)
    );
    
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('[Review Config] PUT error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update configuration' } });
  }
});

// ── Group Review Config ──

// GET /api/admin/review/groups/:groupId/config
router.get('/groups/:groupId/config', requireReviewSupervisionConfig, async (req: Request, res: Response) => {
  try {
    const config = await getGroupReviewConfig(req.params.groupId);
    if (!config) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No group config found' } });
    }
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// PUT /api/admin/review/groups/:groupId/config
router.put('/groups/:groupId/config', requireReviewSupervisionConfig, async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { reviewerCountOverride, supervisionPolicy, supervisionSamplePercentage } = req.body;

    if (supervisionPolicy !== undefined && supervisionPolicy !== null) {
      if (!['all', 'sampled', 'none'].includes(supervisionPolicy)) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'supervisionPolicy must be "all", "sampled", or "none"' } });
      }
    }

    if (supervisionSamplePercentage !== undefined && supervisionSamplePercentage !== null) {
      if (typeof supervisionSamplePercentage !== 'number' || supervisionSamplePercentage < 1 || supervisionSamplePercentage > 100) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'supervisionSamplePercentage must be 1-100' } });
      }
    }

    if (reviewerCountOverride !== undefined && reviewerCountOverride !== null) {
      if (typeof reviewerCountOverride !== 'number' || reviewerCountOverride < 1) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'reviewerCountOverride must be >= 1' } });
      }
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO group_review_config (group_id, reviewer_count_override, supervision_policy, supervision_sample_percentage)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (group_id) DO UPDATE SET
         reviewer_count_override = EXCLUDED.reviewer_count_override,
         supervision_policy = EXCLUDED.supervision_policy,
         supervision_sample_percentage = EXCLUDED.supervision_sample_percentage,
         updated_at = NOW()
       RETURNING *`,
      [groupId, reviewerCountOverride ?? null, supervisionPolicy ?? null, supervisionSamplePercentage ?? null],
    );

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        groupId: row.group_id,
        reviewerCountOverride: row.reviewer_count_override,
        supervisionPolicy: row.supervision_policy,
        supervisionSamplePercentage: row.supervision_sample_percentage,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// DELETE /api/admin/review/groups/:groupId/config
router.delete('/groups/:groupId/config', requireReviewSupervisionConfig, async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM group_review_config WHERE group_id = $1', [req.params.groupId]);
    res.json({ success: true, data: null });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
});

export default router;
