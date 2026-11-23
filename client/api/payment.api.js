import { request } from './http';

/**
 * Payment Service API calls
 */

export const getPaymentHistoryApi = () => {
  return request('/api/payments', {
    method: 'GET'
  });
};

export const getPaymentByIdApi = (id) => {
  return request(`/api/payments/${id}`, {
    method: 'GET'
  });
};
