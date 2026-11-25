import authService from '../services/auth.service.js';
import config from '../config/index.js';
import { parseDurationToMs } from '../../utils/duration.js';
import { success, error } from '../../utils/response.js';

const COOKIE_NAME = process.env.COOKIE_NAME || 'token';
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  path: '/',
  maxAge: parseDurationToMs(config.JWT_EXPIRES_IN || '24h')
});

class AuthController {
  async register(req, res) {
    try {
      const result = await authService.register(req.body);
      res.cookie(COOKIE_NAME, result.token, getCookieOptions());
      return success(res, result, 'Account registered successfully', 201);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  async login(req, res) {
    try {
      const result = await authService.login(req.body);
      res.cookie(COOKIE_NAME, result.token, getCookieOptions());
      return success(res, result, 'Login successful', 200);
    } catch (err) {
      return error(res, err.message, err.status || 401);
    }
  }

  async logout(req, res) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    return success(res, null, 'Logged out successfully', 200);
  }

  async verify(req, res) {
    try {
      const token = req.cookies?.[COOKIE_NAME] || req.headers['authorization']?.split(' ')[1] || req.query.token;
      const result = authService.verify(token);
      return success(res, result, 'Token is valid');
    } catch (err) {
      return error(res, err.message, err.status || 401);
    }
  }
}

export default new AuthController();
