import { error } from '../../utils/response.js';

/**
 * Service-level authentication & authorization middleware
 * Consumes headers populated by the API Gateway
 */
const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return error(res, 'Authentication required: User ID header missing', 401);
  }
  next();
};

const requireAdmin = (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'admin') {
    return error(res, 'Access denied: Administrator privileges required', 403);
  }
  next();
};

export { requireAuth, requireAdmin };
export default {
  requireAuth,
  requireAdmin
};
