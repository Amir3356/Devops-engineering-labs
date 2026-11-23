import { error } from '../../utils/response.js';

/**
 * Service-level authentication & role authorization middleware
 */
const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return error(res, 'Authentication required: User ID header missing', 401);
  }
  next();
};

const requireAdminRole = (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'admin') {
    return error(res, 'Access denied: Admin role required', 403);
  }
  next();
};

export { requireAuth, requireAdminRole };
export default {
  requireAuth,
  requireAdminRole
};
