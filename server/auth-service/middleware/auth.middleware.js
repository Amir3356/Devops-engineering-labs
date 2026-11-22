import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { error } from '../../utils/response.js';

const verifyTokenMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return error(res, 'Token missing', 401);
  }

  jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
    if (err) {
      return error(res, 'Invalid or expired token', 403);
    }
    req.user = decoded;
    next();
  });
};

export { verifyTokenMiddleware };
export default {
  verifyTokenMiddleware
};
