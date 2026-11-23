import purchaseService from '../services/purchase.service.js';
import { success, error } from '../../utils/response.js';

class PurchaseController {
  async getPurchases(req, res) {
    try {
      const data = await purchaseService.getAllPurchases();
      return success(res, data, 'Purchases retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getPurchaseById(req, res) {
    try {
      const data = await purchaseService.getPurchaseById(req.params.id);
      return success(res, data, 'Purchase retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  async createPurchase(req, res) {
    try {
      const data = await purchaseService.createPurchase(req.body);
      return success(res, data, 'Purchase batch created successfully', 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  async updatePurchase(req, res) {
    try {
      const data = await purchaseService.updatePurchase(req.params.id, req.body);
      return success(res, data, 'Purchase batch updated successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  async deletePurchase(req, res) {
    try {
      const data = await purchaseService.deletePurchase(req.params.id);
      return success(res, data, 'Purchase batch deleted successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }
}

export default new PurchaseController();
