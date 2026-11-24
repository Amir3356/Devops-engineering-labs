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

// Server expects { stockQuantity, productName? }
export const updateStockApi = (productId, stockQuantity, productName) => {
  return request(`/api/inventory/stock/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({ stockQuantity, productName })
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
