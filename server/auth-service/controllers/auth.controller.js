import authService from '../services/auth.service.js';
import { success, error } from '../../utils/response.js';

class AuthController {
  async register(req, res) {
    try {
      const result = await authService.register(req.body);
      return success(res, result, 'Account registered successfully', 201);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  async login(req, res) {
    try {
      const result = await authService.login(req.body);
      return success(res, result, 'Login successful', 200);
    } catch (err) {
      return error(res, err.message, err.status || 401);
    }
  }

  async logout(req, res) {
    return success(res, null, 'Logged out successfully', 200);
  }

  async verify(req, res) {
    try {
      const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
      const result = authService.verify(token);
      return success(res, result, 'Token is valid');
    } catch (err) {
      return error(res, err.message, err.status || 401);
    }
  }
}

export default new AuthController();
