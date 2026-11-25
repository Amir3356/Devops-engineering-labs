import authService from '../services/auth.service.js';
import { success, error } from '../../utils/response.js';

const COOKIE_NAME = 'token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

class AuthController {
  async register(req, res) {
    try {
      const result = await authService.register(req.body);
      res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
      return success(res, result, 'Account registered successfully', 201);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  async login(req, res) {
    try {
      const result = await authService.login(req.body);
      res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
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
