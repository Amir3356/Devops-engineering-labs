import { error } from '../../utils/response.js';

/**
 * Centralized error handling middleware for API Gateway
 */
const errorHandler = (err, req, res, next) => {
  console.error('\x1b[31m[API GATEWAY ERROR]\x1b[0m', err.message || err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred in API Gateway';

  return error(res, message, statusCode, {
    path: req.originalUrl,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

export default errorHandler;
