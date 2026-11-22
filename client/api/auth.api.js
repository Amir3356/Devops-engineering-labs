import { request } from './http';

/**
 * Authentication & User Service API Calls
 */

export const loginApi = (credentials) => {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
};

export const registerApi = (registrationData) => {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(registrationData)
  });
};

export const logoutApi = () => {
  return request('/api/auth/logout', {
    method: 'POST'
  });
};

export const getProfileApi = () => {
  return request('/api/users/profile', {
    method: 'GET'
  });
};

export const updateProfileApi = (profileData) => {
  return request('/api/users/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData)
  });
};

export const getCustomersApi = () => {
  return request('/api/users/customers', {
    method: 'GET'
  });
};
