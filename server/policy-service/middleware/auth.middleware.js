import { error } from '../../utils/response.js';

export const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return error(res, 'Authentication required: User ID header missing', 401);
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'admin') {
    return error(res, 'Access denied: Administrator privileges required', 403);
  }
  next();
};

export default { requireAuth, requireAdmin };
