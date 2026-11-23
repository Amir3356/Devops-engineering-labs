import axios from 'axios';
import { error } from '../utils/response.js';

/**
 * Reverse Proxy helper that dispatches requests from API Gateway to downstream microservices using Axios.
 */
const proxyRequest = (targetBaseUrl) => {
  return async (req, res) => {
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

      const response = await axios({
        url,
        method: req.method,
        headers,
        data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
        validateStatus: () => true // Allow all status codes to pass through to the client
      });

      return res.status(response.status).json(response.data);
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || (err.cause && (err.cause.code === 'ECONNREFUSED' || err.cause.code === 'ENOTFOUND'))) {
        const code = err.code || err.cause?.code;
        return error(
          res,
          `Downstream service at ${targetBaseUrl} is currently offline or unreachable.`,
          503,
          { target: targetBaseUrl, code }
        );
      }
      return error(res, `API Gateway Proxy Error: ${err.message}`, 502);
    }
  };
};

export default proxyRequest;
