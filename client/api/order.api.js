import { request } from './http';

/**
 * Order & Payment Services API Calls
 */

export const placeOrderApi = (orderData) => {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(orderData)
  });
};

export const getOrdersApi = () => {
  return request('/api/orders', {
    method: 'GET'
  });
};

export const getAllOrdersAdminApi = () => {
  return request('/api/orders/all', {
    method: 'GET'
  });
};

export const updateOrderStatusApi = (orderId, status) => {
  return request(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
};

export const cancelOrderApi = (orderId) => {
  return request(`/api/orders/${orderId}/cancel`, {
    method: 'POST'
  });
};
