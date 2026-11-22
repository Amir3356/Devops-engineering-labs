import { request } from './http';

/**
 * Product Service API Calls
 */

export const getProductsApi = (query = {}) => {
  const params = new URLSearchParams();
  if (query.category && query.category !== 'All') params.append('category', query.category);
  if (query.search) params.append('search', query.search);
  if (query.sortBy) params.append('sortBy', query.sortBy);

  const qs = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/products${qs}`, {
    method: 'GET'
  });
};

export const getProductByIdApi = (id) => {
  return request(`/api/products/${id}`, {
    method: 'GET'
  });
};

export const getCategoriesApi = () => {
  return request('/api/products/categories', {
    method: 'GET'
  });
};

export const createProductApi = (productData) => {
  return request('/api/products', {
    method: 'POST',
    body: JSON.stringify(productData)
  });
};

export const updateProductApi = (id, updates) => {
  return request(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
};

export const deleteProductApi = (id) => {
  return request(`/api/products/${id}`, {
    method: 'DELETE'
  });
};
