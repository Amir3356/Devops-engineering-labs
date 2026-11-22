import notificationRepository from '../repositories/notification.repository.js';

/**
 * Notification Domain Service
 */
class NotificationService {
  async sendNotification({ userId, title, message, type }) {
    if (!userId || !title || !message) {
      throw new Error('userId, title, and message are required');
    }
    return notificationRepository.create({ userId, title, message, type });
  }

  async getUserNotifications(userId) {
    return notificationRepository.findByUserId(userId);
  }

  async getAllNotifications() {
    return notificationRepository.findAll();
  }

  async markRead(id) {
    return notificationRepository.markAsRead(id);
  }
}

export default new NotificationService();
