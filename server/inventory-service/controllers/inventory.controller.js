import inventoryService from '../services/inventory.service.js';
import { success, error } from '../../utils/response.js';

/**
 * Inventory Controller
 */
class InventoryController {
  async getAllStock(req, res) {
    try {
      const stock = await inventoryService.getAllStock();
      return success(res, stock.map(s => s.toJSON()), 'Inventory stock retrieved');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getLowStock(req, res) {
    try {
      const lowStock = await inventoryService.getLowStockItems();
      return success(res, lowStock.map(s => s.toJSON()), 'Low stock items retrieved');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getProductStock(req, res) {
    try {
      const { productId } = req.params;
      const item = await inventoryService.getStockByProduct(productId);
      return success(res, item.toJSON(), 'Product stock retrieved');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  async updateStock(req, res) {
    try {
      const { productId } = req.params;
      const { stockQuantity, productName } = req.body;

      if (stockQuantity === undefined) {
        return error(res, 'stockQuantity is required', 400);
      }

      const updated = await inventoryService.updateProductStock(productId, stockQuantity, productName);
      return success(res, updated.toJSON(), 'Inventory stock updated successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  async deductStock(req, res) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return error(res, 'Items array required for stock deduction', 400);
      }

      const results = await inventoryService.deductItems(items);
      return success(res, results.map(r => r.toJSON()), 'Stock successfully deducted for order');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  async replenishStock(req, res) {
    try {
      const { productId, amount } = req.body;
      if (!productId || !amount) {
        return error(res, 'productId and amount are required', 400);
      }

      const updated = await inventoryService.replenishProduct(productId, amount);
      return success(res, updated.toJSON(), 'Stock replenished successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  async checkAvailability(req, res) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return error(res, 'Items array required', 400);
      }

      const result = await inventoryService.checkAvailability(items);
      return success(res, result, 'Stock availability checked');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }
}

export default new InventoryController();
