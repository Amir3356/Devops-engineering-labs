import { request } from './http';

/**
 * Policy Service API calls (via API Gateway → policy-service :5009)
 */

export const INVENTORY_ALERTS_POLICY = 'inventory-alerts';

export const getPoliciesApi = () => {
  return request('/api/policies', { method: 'GET' });
};

export const getPolicyApi = (key) => {
  return request(`/api/policies/${key}`, { method: 'GET' });
};

/** Partial update — settings not sent keep their current values. Admin only. */
export const updatePolicyApi = (key, settings) => {
  return request(`/api/policies/${key}`, {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
};

/** Reset a policy to its defaults. Admin only. */
export const resetPolicyApi = (key) => {
  return request(`/api/policies/${key}`, { method: 'DELETE' });
};
