import policyService from '../services/policy.service.js';
import { success, error } from '../../utils/response.js';

const statusOf = (err, fallback) => err.status || fallback;

class PolicyController {
  async getPolicies(req, res) {
    try {
      const data = await policyService.getAllPolicies();
      return success(res, data.map((p) => p.toJSON()), 'Policies retrieved successfully');
    } catch (err) {
      return error(res, err.message, statusOf(err, 500));
    }
  }

  async getPolicy(req, res) {
    try {
      const data = await policyService.getPolicy(req.params.key);
      return success(res, data.toJSON(), 'Policy retrieved successfully');
    } catch (err) {
      return error(res, err.message, statusOf(err, 500));
    }
  }

  async updatePolicy(req, res) {
    try {
      const body = req.body?.settings ?? req.body;
      const data = await policyService.updatePolicy(req.params.key, body, req.headers['x-user-id']);
      return success(res, data.toJSON(), 'Policy updated successfully');
    } catch (err) {
      return error(res, err.message, statusOf(err, 400));
    }
  }

  async resetPolicy(req, res) {
    try {
      const data = await policyService.resetPolicy(req.params.key);
      return success(res, data.toJSON(), 'Policy reset to defaults');
    } catch (err) {
      return error(res, err.message, statusOf(err, 400));
    }
  }
}

export default new PolicyController();
