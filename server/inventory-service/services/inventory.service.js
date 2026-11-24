import inventoryRepository from '../repositories/inventory.repository.js';

/**
 * Inventory Domain Service
 */
class InventoryService {
  async getAllStock() {
    return inventoryRepository.findAll();
  }

  async getStockByProduct(productId) {
    const item = await inventoryRepository.findByProductId(productId);
    if (!item) {
      throw new Error(`Inventory item for product ${productId} not found`);
    }
    return item;
  }

  async getLowStockItems() {
    return inventoryRepository.getLowStock();
  }

  async updateProductStock(productId, stockQuantity, productName = null) {
    if (isNaN(parseInt(stockQuantity, 10)) || parseInt(stockQuantity, 10) < 0) {
      throw new Error('Stock quantity must be a non-negative integer');
    }
    return inventoryRepository.updateStock(productId, parseInt(stockQuantity, 10), productName);
  }

  async deductItems(items) {
    const results = [];
    for (const item of items) {
      const updated = await inventoryRepository.deductStock(item.productId, item.quantity);
      if (!updated) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
      results.push(updated);
    }
    return results;
  }

  /**
   * @param {object} [batch] optional { productName, category, batchId, expiresAt }.
   * With a productName the row is created when missing and the batch details are stored.
   */
  async replenishProduct(productId, amount, batch = {}) {
    const qty = parseInt(amount, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Replenishment amount must be greater than 0');
    }
    if (batch.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(batch.expiresAt)) {
      throw new Error('expiresAt must be a date in YYYY-MM-DD format');
    }
    if (batch.productName) {
      return inventoryRepository.addBatchStock({ productId, quantity: qty, ...batch });
    }
    const updated = await inventoryRepository.replenishStock(productId, qty);
    if (!updated) {
      throw new Error(`No inventory record for product ${productId}`);
    }
    return updated;
  }

  async checkAvailability(items) {
    const availability = [];
    for (const item of items) {
      const stockItem = await inventoryRepository.findByProductId(item.productId);
      const currentStock = stockItem ? stockItem.stockQuantity : 0;
      const isAvailable = currentStock >= item.quantity;
      availability.push({
        productId: item.productId,
        requested: item.quantity,
        available: currentStock,
        inStock: isAvailable
      });
    }
    const allAvailable = availability.every(a => a.inStock);
    return { allAvailable, items: availability };
  }
}

export default new InventoryService();
