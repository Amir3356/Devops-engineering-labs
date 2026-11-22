/**
 * Inventory Model / Domain Entity
 */
class InventoryModel {
  constructor({ productId, productName, stockQuantity, lowStockThreshold, updatedAt }) {
    this.productId = productId;
    this.productName = productName || 'Product';
    this.stockQuantity = parseInt(stockQuantity, 10) || 0;
    this.lowStockThreshold = parseInt(lowStockThreshold, 10) || 5;
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  isLowStock() {
    return this.stockQuantity <= this.lowStockThreshold;
  }

  toJSON() {
    return {
      productId: this.productId,
      productName: this.productName,
      stockQuantity: this.stockQuantity,
      lowStockThreshold: this.lowStockThreshold,
      isLowStock: this.isLowStock(),
      updatedAt: this.updatedAt
    };
  }
}

export default InventoryModel;
