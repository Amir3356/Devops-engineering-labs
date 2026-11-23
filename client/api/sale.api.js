import { request } from './http';

/**
 * Sale Service API calls (Port 5005 via API Gateway)
 */

export const getSalesApi = () => {
  return request('/api/sales', {
    method: 'GET'
  });
};

export const getSaleByIdApi = (id) => {
  return request(`/api/sales/${id}`, {
    method: 'GET'
  });
};

export const createSaleApi = (saleData) => {
  return request('/api/sales', {
    method: 'POST',
    body: JSON.stringify(saleData)
  });
};

export const deleteSaleApi = (id) => {
  return request(`/api/sales/${id}`, {
    method: 'DELETE'
  });
};
