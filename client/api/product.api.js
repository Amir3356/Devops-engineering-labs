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

export const createCategoryApi = (categoryData) => {
  return request('/api/products/categories', {
    method: 'POST',
    body: JSON.stringify(categoryData)
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

export const uploadProductImageApi = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('ecommerce_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:5000';
  const response = await fetch(`${GATEWAY_URL}/api/products/upload`, {
    method: 'POST',
    headers,
    body: formData
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Image upload failed');
  }
  return payload;
};
