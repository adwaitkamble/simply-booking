import { Router, Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export const notificationRouter = Router();

notificationRouter.use(authenticateUser);

/**
 * POST /api/notifications/token
 * Save device Expo Push Token to current logged-in user profile
 */
notificationRouter.post('/token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Push token is required.' });
    }

    const userId = req.user!.userId;
    await NotificationService.savePushToken(userId, token);

    res.json({
      success: true,
      message: 'Push token saved successfully.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notifications
 * Fetch latest 50 notifications for logged-in user
 */
notificationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const data = await NotificationService.getNotifications(userId);
    res.json({
      success: true,
      data: data.notifications,
      unreadCount: data.unreadCount,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
notificationRouter.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const updated = await NotificationService.markAsRead(notificationId, userId);
    res.json({
      success: true,
      data: updated,
      message: 'Notification marked as read.',
    });
  } catch (err) {
    next(err);
  }
});
