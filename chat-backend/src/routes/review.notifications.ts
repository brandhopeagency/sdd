import { Router, Request, Response } from 'express';
import {
  reviewAuth,
  requireReviewAccess,
} from '../middleware/reviewAuth';
import {
  getNotifications,
  getBannerAlerts,
  markAsRead,
  markAllAsRead,
} from '../services/reviewNotification.service';

const router = Router();
router.use(...reviewAuth);

// ── GET / ──
// Get paginated notifications for the current user.
// (Mounted at /api/review/notifications, so full path is /api/review/notifications)
router.get(
  '/',
  requireReviewAccess,
  async (req: Request, res: Response) => {
    try {
      const recipientId = req.user?.id;
      if (!recipientId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const page = req.query.page ? Number(req.query.page) : undefined;
      const pageSize = (req.query.pageSize ?? req.query.limit) ? Number(req.query.pageSize ?? req.query.limit) : undefined;
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await getNotifications(recipientId, {
        page,
        pageSize,
        unreadOnly,
      });

      res.json({
        success: true,
        data: {
          items: result.data,
          total: result.total,
          unreadCount: result.unreadCount,
        },
      });
    } catch (error) {
      console.error('[Notifications] Error getting notifications:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get notifications' },
      });
    }
  },
);

// ── GET /banners ──
// Get banner alert counts for the current user.
// (Mounted at /api/review/notifications, so full path is /api/review/notifications/banners)
router.get(
  '/banners',
  requireReviewAccess,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const alerts = await getBannerAlerts(userId);

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      console.error('[Notifications] Error getting banner alerts:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get banner alerts' },
      });
    }
  },
);

// ── POST /read-all ── (must be before /:notificationId to avoid "read-all" matching as id)
// Mark all notifications as read for the current user.
router.post(
  '/read-all',
  requireReviewAccess,
  async (req: Request, res: Response) => {
    try {
      const recipientId = req.user?.id;
      if (!recipientId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      await markAllAsRead(recipientId);

      res.json({ success: true });
    } catch (error) {
      console.error('[Notifications] Error marking all as read:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to mark all as read' },
      });
    }
  },
);

// ── PATCH /:notificationId/read ── (also supports POST per spec)
// Mark a single notification as read.
router.patch(
  '/:notificationId/read',
  requireReviewAccess,
  async (req: Request, res: Response) => {
    try {
      const recipientId = req.user?.id;
      if (!recipientId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const { notificationId } = req.params;
      await markAsRead(notificationId, recipientId);

      res.json({ success: true });
    } catch (error) {
      console.error('[Notifications] Error marking as read:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notification as read' },
      });
    }
  },
);

export default router;
