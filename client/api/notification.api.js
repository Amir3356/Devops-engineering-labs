import { request } from './http';

/**
 * Notification Service API calls
 */

export const getNotificationsApi = () => {
  return request('/api/notifications', {
    method: 'GET'
  });
};

export const markNotificationAsReadApi = (id) => {
  return request(`/api/notifications/${id}/read`, {
    method: 'PATCH'
  });
};
