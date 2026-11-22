import { authenticateToken, optionalAuth, requireAdmin, requireCustomer } from './auth.js';
import errorHandler from './errorHandler.js';
import requestLogger from './requestLogger.js';
import rateLimiter from './rateLimiter.js';
import notFoundHandler from './notFound.js';

export {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireCustomer,
  errorHandler,
  requestLogger,
  rateLimiter,
  notFoundHandler
};

export default {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireCustomer,
  errorHandler,
  requestLogger,
  rateLimiter,
  notFoundHandler
};
