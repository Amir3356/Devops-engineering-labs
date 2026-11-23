import { request } from './http';

/**
 * Payment Service API calls
 */

export const processPaymentApi = (paymentData) => {
  return request('/api/payments/process', {
    method: 'POST',
    body: JSON.stringify(paymentData)
  });
};

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

export const getAllPaymentRecordsApi = () => {
  return request('/api/payments/records', {
    method: 'GET'
  });
};

export const getPaymentSalesReportApi = () => {
  return request('/api/payments/sales-report', {
    method: 'GET'
  });
};
