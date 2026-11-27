import { request } from './http';

/**
 * Notification Service API calls (via the API gateway, which identifies the user from the JWT)
 */

/** Newest first. Options: { limit, before (createdAt cursor), unread } */
export const getNotificationsApi = ({ limit = 50, before, unread } = {}) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  if (unread) params.set('unread', 'true');
  return request(`/api/notifications?${params}`, { method: 'GET' });
};

/** { count } — cached server-side in Redis; used by the bell badge */
export const getUnreadCountApi = () => {
  return request('/api/notifications/unread-count', { method: 'GET' });
};

export const markNotificationAsReadApi = (id) => {
  return request(`/api/notifications/${id}/read`, { method: 'PATCH' });
};

export const markAllNotificationsAsReadApi = () => {
  return request('/api/notifications/read-all', { method: 'PATCH' });
};
