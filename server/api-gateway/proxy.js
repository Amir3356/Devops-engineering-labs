import { error } from '../utils/response.js';

/**
 * Reverse Proxy helper that dispatches requests from API Gateway to downstream microservices.
 * Uses native fetch (Node.js 18+).
 */
const proxyRequest = (targetBaseUrl) => {
  return async (req, res, next) => {
    try {
      const url = `${targetBaseUrl}${req.originalUrl}`;
      const headers = {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': 'application/json'
      };

      // Forward user context extracted by authentication middleware
      if (req.headers['x-user-id']) headers['x-user-id'] = req.headers['x-user-id'];
      if (req.headers['x-user-phone']) headers['x-user-phone'] = req.headers['x-user-phone'];
      if (req.headers['x-user-role']) headers['x-user-role'] = req.headers['x-user-role'];
      if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];

      const fetchOptions = {
        method: req.method,
        headers
      };

      // Only attach body for methods that allow payloads
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(url, fetchOptions);
      const data = await response.json().catch(() => ({}));

      return res.status(response.status).json(data);
    } catch (err) {
      if (err.cause && (err.cause.code === 'ECONNREFUSED' || err.cause.code === 'ENOTFOUND')) {
        return error(
          res,
          `Downstream service at ${targetBaseUrl} is currently offline or unreachable.`,
          503,
          { target: targetBaseUrl, code: err.cause.code }
        );
      }
      return error(res, `API Gateway Proxy Error: ${err.message}`, 502);
    }
  };
};

export default proxyRequest;
