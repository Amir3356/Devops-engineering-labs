import axios from 'axios';
import config from './config/index.js';
import { parseDurationToMs } from '../utils/duration.js';
import { error } from '../utils/response.js';
import { announceIfCatalogChanged } from './realtime.js';

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

      // Forward user context only when it came from a verified token (req.user is set by the
      // auth middleware) — x-user-* headers sent by the browser itself are never trusted
      if (req.user) {
        for (const name of ['x-user-id', 'x-user-phone', 'x-user-role', 'x-user-email', 'x-user-name']) {
          if (req.headers[name]) headers[name] = req.headers[name];
        }
      }
      if (req.headers['authorization']) {
        headers['authorization'] = req.headers['authorization'];
      } else if (req.cookies?.token) {
        headers['authorization'] = `Bearer ${req.cookies.token}`;
      }

      const response = await axios({
        url,
        method: req.method,
        headers,
        data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
        validateStatus: () => true // Allow all status codes to pass through to the client
      });

      // Forward Set-Cookie header or set HttpOnly cookie on auth endpoints
      if (response.headers['set-cookie']) {
        res.setHeader('set-cookie', response.headers['set-cookie']);
      }

      const isAuthRoute = req.originalUrl.startsWith('/api/auth');
      if (isAuthRoute && response.data?.data?.token) {
        res.cookie('token', response.data.data.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: parseDurationToMs(config.JWT_EXPIRES_IN || '24h')
        });
      } else if (isAuthRoute && req.originalUrl.includes('logout')) {
        res.clearCookie('token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        });
      }

      announceIfCatalogChanged(req, response.status);
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
