import userService from '../services/user.service.js';
import { success, error } from '../../utils/response.js';

class UserController {
  async register(req, res) {
    try {
      const result = await userService.register(req.body);
      return success(res, result, 'Customer registered successfully', 201);
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }

  async login(req, res) {
    try {
      const result = await userService.login(req.body);
      return success(res, result, 'Login successful', 200);
    } catch (err) {
      return error(res, err.message, err.status || 401);
    }
  }

  async logout(req, res) {
    return success(res, null, 'Logged out successfully', 200);
  }

  async getProfile(req, res) {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      if (!userId) {
        return error(res, 'User ID missing from authentication context', 400);
      }
      const profile = await userService.getProfile(userId);
      return success(res, profile, 'Profile retrieved successfully');
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      if (!userId) {
        return error(res, 'User ID missing from authentication context', 400);
      }
      const updated = await userService.updateProfile(userId, req.body);
      return success(res, updated, 'Profile updated successfully');
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }

  async getAllCustomers(req, res) {
    try {
      const customers = await userService.getAllCustomers();
      return success(res, customers, 'Customer list retrieved successfully');
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }

  async getUserById(req, res) {
    try {
      const user = await userService.getUserById(req.params.id);
      return success(res, user, 'User details retrieved successfully');
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }
}

export default new UserController();
