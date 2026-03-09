import { Router, Request, Response } from 'express';
import {
  reviewAuth,
  requireReviewAccess,
  requireReviewTeamDashboard,
} from '../middleware/reviewAuth';
import {
  getReviewerStats,
  getTeamStats,
} from '../services/reviewDashboard.service';
import { getBannerAlerts } from '../services/reviewNotification.service';

const router = Router();
router.use(...reviewAuth);

/**
 * GET /me
 * Get personal reviewer dashboard statistics.
 * (Mounted at /api/review/dashboard, so full path is /api/review/dashboard/me)
 */
router.get(
  '/me',
  requireReviewAccess,
  async (req: Request, res: Response) => {
    try {
      const reviewerId = req.user?.id;
      if (!reviewerId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const { period = 'all' } = req.query as { period?: string };
      const stats = await getReviewerStats(reviewerId, period);

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('[Review Dashboard] Error fetching personal stats:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dashboard stats' },
      });
    }
  },
);

/**
 * GET /team
 * Get team-wide dashboard statistics.
 * (Mounted at /api/review/dashboard, so full path is /api/review/dashboard/team)
 */
router.get(
  '/team',
  requireReviewTeamDashboard,
  async (req: Request, res: Response) => {
    try {
      const { period = 'all' } = req.query as { period?: string };
      const stats = await getTeamStats(period);

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('[Review Dashboard] Error fetching team stats:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch team dashboard stats' },
      });
    }
  },
);

/**
 * GET /banners
 * Get banner alert counts for the current user.
 * (Mounted at /api/review/dashboard, so full path is /api/review/dashboard/banners)
 */
router.get(
  '/banners',
  requireReviewAccess,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const alerts = await getBannerAlerts(userId);

      res.json({ success: true, data: alerts });
    } catch (error) {
      console.error('[Review Dashboard] Error fetching banner alerts:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch banner alerts' },
      });
    }
  },
);

export default router;
