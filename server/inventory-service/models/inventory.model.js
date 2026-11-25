/**
 * Inventory Model / Domain Entity
 */
class InventoryModel {
  constructor({ productId, productName, category, batchId, expiresAt, unitSellingPrice, totalSellingPrice, stockQuantity, lowStockThreshold, version, updatedAt }) {
    this.productId = productId;
    this.productName = productName || 'Product';
    this.category = category || null;
    this.batchId = batchId || null;
    this.expiresAt = expiresAt || null; // YYYY-MM-DD
    // NUMERIC columns arrive as strings from pg; null when never priced
    this.unitSellingPrice = unitSellingPrice == null ? null : Number(unitSellingPrice);
    this.totalSellingPrice = totalSellingPrice == null ? null : Number(totalSellingPrice);
    this.stockQuantity = parseInt(stockQuantity, 10) || 0;
    this.lowStockThreshold = parseInt(lowStockThreshold, 10) || 5;
    // Row version for optimistic concurrency control (sent back as expectedVersion)
    this.version = Number(version) || 0;
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  isLowStock() {
    return this.stockQuantity <= this.lowStockThreshold;
  }

  toJSON() {
    return {
      productId: this.productId,
      productName: this.productName,
      category: this.category,
      batchId: this.batchId,
      expiresAt: this.expiresAt,
      unitSellingPrice: this.unitSellingPrice,
      totalSellingPrice: this.totalSellingPrice,
      stockQuantity: this.stockQuantity,
      lowStockThreshold: this.lowStockThreshold,
      isLowStock: this.isLowStock(),
      version: this.version,
      updatedAt: this.updatedAt
    };
  }
}

export default InventoryModel;
