import crypto from 'crypto';

/**
 * Notification Model / Domain Entity
 */
class NotificationModel {
  constructor({ id, userId, title, message, type, isRead, createdAt }) {
    this.id = id || `notif-${crypto.randomUUID().slice(0, 8)}`;
    this.userId = userId;
    this.title = (title || '').trim();
    this.message = (message || '').trim();
    this.type = type || 'info'; // 'order', 'payment', 'inventory', 'system', 'info'
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
      isRead: this.isRead,
      createdAt: this.createdAt
    };
  }
}

export default NotificationModel;
