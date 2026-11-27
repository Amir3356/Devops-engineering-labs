import client from 'prom-client';
import notificationRepository from '../repositories/notification.repository.js';
import { INAPP_CATALOG } from '../events/inapp.catalog.js';
import { publishToUser, getUnreadCount, invalidateUnreadCount } from '../realtime/publisher.js';
import { registry } from '../../utils/metrics.js';

const created = new client.Counter({
  name: 'notifications_created_total',
  help: 'In-app notifications created, by category, type and source (event | api)',
  labelNames: ['category', 'type', 'source'],
  registers: [registry]
});

/**
 * Notification Domain Service
 *
 * In-app flow (Phase 1 of the notification design):
 *   Kafka event ─► createFromEvent (catalogue → row, same transaction as the inbox) ─► commit
 *              ─► afterCommit: invalidate unread cache, publish { notification, unreadCount } to Redis
 *              ─► gateway forwards it to that user's WebSocket ─► bell badge updates instantly
 */
class NotificationService {
  unreadCount(userId) {
    return getUnreadCount(userId, () => notificationRepository.countUnread(userId));
  }

  /** Push a new notification + fresh unread count to the user's open tabs (best effort). */
  async deliverRealtime(notification) {
    await invalidateUnreadCount(notification.userId);
    const unreadCount = await this.unreadCount(notification.userId);
    await publishToUser(notification.userId, {
      type: 'notification.new',
      notification: notification.toJSON(),
      unreadCount
    });
  }

  /**
   * Called by the Kafka consumer inside its transaction (`ctx.client`, `ctx.afterCommit`).
   * Idempotent: the key eventId:userId is UNIQUE, so a redelivered event creates nothing.
   */
  async createFromEvent(event, ctx) {
    const build = INAPP_CATALOG[event.type];
    if (!build) return null;
    const spec = build(event.payload || {}, event);
    if (!spec?.userId) return null;

    const notification = await notificationRepository.insertFromEvent(ctx.client, {
      ...spec,
      userId: String(spec.userId),
      idempotencyKey: `${event.eventId}:${spec.userId}`
    });
    if (!notification) return null; // already created for this event
    created.inc({ category: notification.category, type: notification.type, source: 'event' });
    // Only after the row is committed: never announce a notification that could still roll back
    ctx.afterCommit(() => this.deliverRealtime(notification));
    return notification;
  }

  async sendNotification({ userId, title, message, type, category, data }) {
    if (!userId || !title || !message) {
      throw new Error('userId, title, and message are required');
    }
    const notification = await notificationRepository.create({ userId: String(userId), title, message, type, category, data });
    created.inc({ category: notification.category, type: notification.type, source: 'api' });
    this.deliverRealtime(notification).catch(() => {});
    return notification;
  }

  async getUserNotifications(userId, options) {
    return notificationRepository.findByUserId(userId, options);
  }

  async getAllNotifications() {
    return notificationRepository.findAll();
  }

  /** Marks the user's own notification as read and tells their other tabs. Null if not theirs. */
  async markRead(id, userId) {
    const notification = await notificationRepository.markAsRead(id, userId);
    if (notification) await this.announceRead(userId, [id]);
    return notification;
  }

  async markAllRead(userId) {
    const ids = await notificationRepository.markAllAsRead(userId);
    if (ids.length) await this.announceRead(userId, ids);
    return ids;
  }

  async announceRead(userId, ids) {
    await invalidateUnreadCount(userId);
    const unreadCount = await this.unreadCount(userId);
    await publishToUser(userId, { type: 'notification.read', ids, unreadCount });
  }
}

export default new NotificationService();
