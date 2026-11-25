import inventoryRepository from '../repositories/inventory.repository.js';
import InventoryModel from '../models/inventory.model.js';
import { cached, invalidate } from '../../utils/cache.js';

// Cached reads for pages (namespaced 'inventory:'). Stock checks and deductions
// used by checkout/sales always read PostgreSQL directly — never the cache.
const KEY_ALL = 'stock:all';
const KEY_ITEM = (productId) => `stock:item:${productId}`;
const toModels = (rows) => rows.map((r) => new InventoryModel(r));
const clearStock = () => invalidate('stock');

/**
 * Run a write and invalidate the stock group only after it committed.
 * A failed or rolled-back write (e.g. not enough stock) changed nothing, so nothing is invalidated.
 */
async function thenClear(promise) {
  const result = await promise;
  await clearStock();
  return result;
}

/**
 * Inventory Domain Service
 */
class InventoryService {
  async getAllStock() {
    const rows = await cached(KEY_ALL, undefined, async () =>
      (await inventoryRepository.findAll()).map((m) => m.toJSON())
    );
    return toModels(rows);
  }

  async getStockByProduct(productId) {
    const row = await cached(KEY_ITEM(productId), undefined, async () => {
      const item = await inventoryRepository.findByProductId(productId);
      if (!item) {
        throw new Error(`Inventory item for product ${productId} not found`);
      }
      return item.toJSON();
    });
    return new InventoryModel(row);
  }

  async getLowStockItems() {
    return inventoryRepository.getLowStock();
  }

  async updateProductStock(productId, stockQuantity, options = null) {
    const qty = parseInt(stockQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      throw new Error('Stock quantity must be a non-negative integer');
    }
    const base = typeof options === 'string' ? { productName: options } : (options || {});
    // The unit price is always derived here (total ÷ quantity), never taken from the client
    const { unitSellingPrice: _ignored, ...opts } = base;
    if (opts.totalSellingPrice !== undefined) {
      const total = Number(opts.totalSellingPrice);
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error('totalSellingPrice must be a number greater than 0');
      }
      if (qty <= 0) {
        throw new Error('Stock quantity must be greater than 0 to set a selling price');
      }
      opts.totalSellingPrice = Math.round(total * 100) / 100;
      opts.unitSellingPrice = Math.round((total / qty) * 100) / 100;
    }
    return thenClear(inventoryRepository.updateStock(productId, qty, opts));
  }

  async deductItems(items) {
    const normalised = items.map((i) => ({ productId: i.productId, quantity: parseInt(i.quantity, 10) }));
    if (normalised.some((i) => !i.productId || !(i.quantity > 0))) {
      throw new Error('Each item needs a productId and a positive quantity');
    }
    return thenClear(inventoryRepository.deductMany(normalised));
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
    if (batch.totalSellingPrice !== undefined) {
      const total = Number(batch.totalSellingPrice);
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error('totalSellingPrice must be a number greater than 0');
      }
      // Unit price is always derived here so it can't disagree with the total
      batch.totalSellingPrice = Math.round(total * 100) / 100;
      batch.unitSellingPrice = Math.round((total / qty) * 100) / 100;
    } else {
      delete batch.unitSellingPrice;
    }
    if (batch.productName) {
      return thenClear(inventoryRepository.addBatchStock({ productId, quantity: qty, ...batch }));
    }
    const updated = await thenClear(inventoryRepository.replenishStock(productId, qty));
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

  async deleteStock(productId) {
    return thenClear(inventoryRepository.deleteStock(productId));
  }
}

export default new InventoryService();
