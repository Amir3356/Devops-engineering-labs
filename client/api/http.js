/**
 * Pure HTTP Transport Layer
 * Routes all API calls through the central API Gateway (Port 5000).
 */

const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL;

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('ecommerce_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${GATEWAY_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || `HTTP Request failed with status ${response.status}`);
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}
