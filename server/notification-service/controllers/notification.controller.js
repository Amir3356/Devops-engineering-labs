import notificationService from '../services/notification.service.js';
import { success, error } from '../../utils/response.js';

/**
 * Notification Controller
 * The caller's identity comes from x-user-id / x-user-role, which the API gateway sets from the
 * verified JWT (never from the browser).
 */
const callerId = (req) => req.headers['x-user-id'];
const isAdmin = (req) => req.headers['x-user-role'] === 'admin';

class NotificationController {
  /** GET /api/notifications?limit=50&before=<createdAt>&unread=true — newest first, cursor paging */
  async getMyNotifications(req, res) {
    try {
      const notifications = await notificationService.getUserNotifications(callerId(req), {
        limit: req.query.limit,
        before: req.query.before || null,
        unreadOnly: req.query.unread === 'true'
      });
      return success(res, notifications.map((n) => n.toJSON()), 'User notifications retrieved');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /** GET /api/notifications/unread-count — cached in Redis, used by the navbar bell */
  async getUnreadCount(req, res) {
    try {
      const count = await notificationService.unreadCount(callerId(req));
      return success(res, { count }, 'Unread notification count');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getAllNotifications(req, res) {
    try {
      const notifications = await notificationService.getAllNotifications();
      return success(res, notifications.map((n) => n.toJSON()), 'All system notifications retrieved');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /** POST /api/notifications — customers notify themselves; only admins may target another user */
  async createNotification(req, res) {
    try {
      const { userId, title, message, type, category, data } = req.body;
      if (userId && String(userId) !== String(callerId(req)) && !isAdmin(req)) {
        return error(res, 'Access denied: only administrators can notify other users', 403);
      }
      const notification = await notificationService.sendNotification({
        userId: userId || callerId(req),
        title,
        message,
        type,
        category,
        data
      });
      return success(res, notification.toJSON(), 'Notification dispatched', 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /** PATCH /api/notifications/:id/read — only the owner's own notification */
  async markAsRead(req, res) {
    try {
      const notification = await notificationService.markRead(req.params.id, callerId(req));
      if (!notification) return error(res, 'Notification not found', 404);
      return success(res, notification.toJSON(), 'Notification marked as read');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /** PATCH /api/notifications/read-all */
  async markAllAsRead(req, res) {
    try {
      const ids = await notificationService.markAllRead(callerId(req));
      return success(res, { updated: ids.length, ids }, `Marked ${ids.length} notification(s) as read`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }
}

export default new NotificationController();
