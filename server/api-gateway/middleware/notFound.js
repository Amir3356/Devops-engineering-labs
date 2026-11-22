import { error } from '../../utils/response.js';

/**
 * 404 Route Not Found Middleware for API Gateway
 * Intercepts requests that do not match any mapped microservice routes.
 */
export const notFoundHandler = (req, res) => {
  return error(
    res,
    `Cannot ${req.method} ${req.originalUrl} - Endpoint not found on API Gateway`,
    404,
    {
      path: req.originalUrl,
      method: req.method,
      suggestion: 'Verify route path against available microservice API endpoints'
    }
  );
};

export default notFoundHandler;
