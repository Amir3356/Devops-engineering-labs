import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { error } from '../../utils/response.js';

/** Helper to extract JWT from HttpOnly cookie or Authorization header */
const extractToken = (req) => {
  return req.cookies?.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
};

/**
 * Authentication Middleware for API Gateway
 * Validates JWT tokens and decorates request headers with user identity
 * before forwarding to downstream microservices.
 */
export const authenticateToken = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return error(res, 'Authentication required: Token missing', 401);
  }

  jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return error(res, 'Authentication failed: Token has expired', 401);
      }
      return error(res, 'Authentication failed: Invalid token', 403);
    }

    req.user = decoded;
    // Set Authorization header for downstream microservices
    req.headers['authorization'] = `Bearer ${token}`;
    // Set headers for downstream microservices to identify the caller
    req.headers['x-user-id'] = String(decoded.id || decoded.userId);
    req.headers['x-user-phone'] = String(decoded.phone || '');
    req.headers['x-user-role'] = String(decoded.role);
    // Signup email/name for receipts; encoded because names may contain non-ASCII characters
    req.headers['x-user-email'] = String(decoded.email || '');
    req.headers['x-user-name'] = encodeURIComponent(String(decoded.name || ''));
    next();
  });
};

/**
 * Optional Authentication: allows guest browsing but extracts identity if token exists
 */
export const optionalAuth = (req, res, next) => {
  const token = extractToken(req);

  if (token) {
    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
      if (!err && decoded) {
        req.user = decoded;
        req.headers['authorization'] = `Bearer ${token}`;
        req.headers['x-user-id'] = String(decoded.id || decoded.userId);
        req.headers['x-user-phone'] = String(decoded.phone || '');
        req.headers['x-user-role'] = String(decoded.role);
        req.headers['x-user-email'] = String(decoded.email || '');
        req.headers['x-user-name'] = encodeURIComponent(String(decoded.name || ''));
      }
      next();
    });
  } else {
    next();
  }
};

/**
 * Authorization: Only Administrator role permitted
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return error(res, 'Access denied: Administrator privileges required', 403);
  }
  next();
};

/**
 * Authorization: Only Customer role permitted
 */
export const requireCustomer = (req, res, next) => {
  if (!req.user || req.user.role !== 'customer') {
    return error(res, 'Access denied: Customer privileges required', 403);
  }
  next();
};

export default {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireCustomer
};
