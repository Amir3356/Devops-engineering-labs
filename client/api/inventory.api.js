import { request } from './http';

/**
 * Inventory Service API calls
 */

export const getAllStockApi = () => {
  return request('/api/inventory', {
    method: 'GET'
  });
};

export const getLowStockApi = () => {
  return request('/api/inventory/low-stock', {
    method: 'GET'
  });
};

export const getProductStockApi = (productId) => {
  return request(`/api/inventory/${productId}`, {
    method: 'GET'
  });
};

export const updateStockApi = (productId, data) => {
  return request(`/api/inventory/stock/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

export const replenishStockApi = (data) => {
  return request('/api/inventory/replenish', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const checkAvailabilityApi = (items) => {
  return request('/api/inventory/check', {
    method: 'POST',
    body: JSON.stringify({ items })
  });
};
