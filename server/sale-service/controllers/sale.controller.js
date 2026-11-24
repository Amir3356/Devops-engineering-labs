import saleService from '../services/sale.service.js';
import { success, error } from '../../utils/response.js';

class SaleController {
  async getSales(req, res) {
    try {
      const data = await saleService.getAllSales();
      return success(res, data, 'Sales transactions retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getSaleById(req, res) {
    try {
      const data = await saleService.getSaleById(req.params.id);
      return success(res, data, 'Sale transaction retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  async createSale(req, res) {
    try {
      const data = await saleService.recordSale(req.body);
      return success(res, data, 'Sale transaction recorded successfully', 201);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  async deleteSale(req, res) {
    try {
      const data = await saleService.deleteSale(req.params.id);
      return success(res, data, 'Sale transaction removed successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }
}

export default new SaleController();
