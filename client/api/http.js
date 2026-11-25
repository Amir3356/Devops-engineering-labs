import axios from 'axios';

/**
 * Axios HTTP Transport Layer
 * Routes all API calls through the central API Gateway (Port 5000).
 */
const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: GATEWAY_URL,
  withCredentials: true, // Send and receive HttpOnly cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach credentials and optional bearer token
apiClient.interceptors.request.use(
  (config) => {
    config.withCredentials = true;
    const token = localStorage.getItem('ecommerce_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to format errors and extract data
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const payload = error.response?.data || {};
    const message = payload.message || error.message || 'HTTP Request failed';
    const customError = new Error(message);
    customError.status = error.response?.status;
    customError.details = payload;
    return Promise.reject(customError);
  }
);

export async function request(endpoint, options = {}) {
  const method = (options.method || 'GET').toLowerCase();
  let data = undefined;

  if (options.body) {
    if (typeof options.body === 'string') {
      try {
        data = JSON.parse(options.body);
      } catch {
        data = options.body;
      }
    } else {
      data = options.body;
    }
  }

  const response = await apiClient({
    url: endpoint,
    method,
    data,
    headers: options.headers || {},
    params: options.params || {}
  });

  return response.data;
}

export default apiClient;
