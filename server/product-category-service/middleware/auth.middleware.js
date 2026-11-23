import { error } from '../../utils/response.js';

/**
 * Validates that the request has an authenticated Administrator role
 * Context header x-user-role is set by the API Gateway
 */
const requireAdmin = (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'admin') {
    return error(res, 'Access denied: Administrator privileges required', 403);
  }
  next();
};

export { requireAdmin };
export default {
  requireAdmin
};
