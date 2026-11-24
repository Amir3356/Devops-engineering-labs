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

// Server expects { stockQuantity, productName?, category?, batchId?, expiresAt? }
export const updateStockApi = (productId, stockQuantity, details = {}) => {
  const body = typeof details === 'string'
    ? { stockQuantity, productName: details }
    : { stockQuantity, ...details };
  return request(`/api/inventory/stock/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
};

// Server expects { productId, amount } plus optional batch details
// { productName, category, batchId, expiresAt (YYYY-MM-DD) }; with productName the row is created if missing.
export const replenishStockApi = (productId, amount, batch = {}) => {
  return request('/api/inventory/replenish', {
    method: 'POST',
    body: JSON.stringify({ productId, amount, ...batch })
  });
};

export const checkAvailabilityApi = (items) => {
  return request('/api/inventory/check', {
    method: 'POST',
    body: JSON.stringify({ items })
  });
};

export const deleteStockApi = (productId) => {
  return request(`/api/inventory/${productId}`, {
    method: 'DELETE'
  });
};
