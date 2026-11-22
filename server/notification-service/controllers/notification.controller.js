import notificationService from '../services/notification.service.js';
import { success, error } from '../../utils/response.js';

/**
 * Notification Controller
 */
class NotificationController {
  async getMyNotifications(req, res) {
    try {
      const userId = req.headers['x-user-id'];
      if (!userId) {
        return error(res, 'Authentication required', 401);
      }

      const notifications = await notificationService.getUserNotifications(userId);
      return success(res, notifications.map(n => n.toJSON()), 'User notifications retrieved');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getAllNotifications(req, res) {
    try {
      const notifications = await notificationService.getAllNotifications();
      return success(res, notifications.map(n => n.toJSON()), 'All system notifications retrieved');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async createNotification(req, res) {
    try {
      const { userId, title, message, type } = req.body;
      const targetUserId = userId || req.headers['x-user-id'];

      const notification = await notificationService.sendNotification({
        userId: targetUserId,
        title,
        message,
        type
      });

      return success(res, notification.toJSON(), 'Notification dispatched', 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const notification = await notificationService.markRead(id);
      return success(res, notification ? notification.toJSON() : null, 'Notification marked as read');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }
}

export default new NotificationController();
