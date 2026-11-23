import { pick, toStr, toIsoDate, listOf } from './_fields';

export const NOTIFICATION_TYPES = Object.freeze(['order', 'alert', 'security', 'success', 'info']);

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} userId
 * @property {string} title
 * @property {string} message
 * @property {'order'|'alert'|'security'|'success'|'info'} type
 * @property {boolean} isRead
 * @property {string|null} createdAt
 */
export const createNotification = (raw = {}) => {
  const type = toStr(pick(raw, 'type'), 'info').toLowerCase();
  return {
    id: toStr(pick(raw, 'id')),
    userId: toStr(pick(raw, 'userId', 'user_id')),
    title: toStr(pick(raw, 'title')),
    message: toStr(pick(raw, 'message')),
    type: NOTIFICATION_TYPES.includes(type) ? type : 'info',
    isRead: pick(raw, 'isRead', 'is_read') === true,
    createdAt: toIsoDate(pick(raw, 'createdAt', 'created_at')),
  };
};

export const createNotificationList = listOf(createNotification);

export const unreadCount = (notifications = []) =>
  notifications.filter((n) => !n.isRead).length;
