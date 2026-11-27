import crypto from 'crypto';

/**
 * Notification Model / Domain Entity
 */
class NotificationModel {
  constructor({ id, userId, title, message, type, category, data, isRead, createdAt }) {
    this.id = id || `notif-${crypto.randomUUID().slice(0, 8)}`;
    this.userId = userId;
    this.title = (title || '').trim();
    this.message = (message || '').trim();
    this.type = type || 'info'; // 'order', 'alert', 'security', 'success', 'info' (client icons)
    this.category = category || 'general'; // 'orders', 'account', 'general' (future: preferences per category)
    this.data = data || {}; // link data, e.g. { orderId } so the client can open the order
    this.isRead = isRead === true;
    this.createdAt = createdAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      message: this.message,
      type: this.type,
      category: this.category,
      data: this.data,
      isRead: this.isRead,
      createdAt: this.createdAt
    };
  }
}

export default NotificationModel;
