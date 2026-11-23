import { request } from './http';

/**
 * Purchase Service API calls (Port 5003 via API Gateway)
 */

export const getPurchasesApi = () => {
  return request('/api/purchases', {
    method: 'GET'
  });
};

export const getPurchaseByIdApi = (id) => {
  return request(`/api/purchases/${id}`, {
    method: 'GET'
  });
};

export const createPurchaseApi = (purchaseData) => {
  return request('/api/purchases', {
    method: 'POST',
    body: JSON.stringify(purchaseData)
  });
};

export const updatePurchaseApi = (id, purchaseData) => {
  return request(`/api/purchases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(purchaseData)
  });
};

export const deletePurchaseApi = (id) => {
  return request(`/api/purchases/${id}`, {
    method: 'DELETE'
  });
};
