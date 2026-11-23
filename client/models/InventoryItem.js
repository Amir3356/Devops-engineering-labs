import { pick, toInt, toStr, toIsoDate, listOf } from './_fields';

/**
 * @typedef {Object} InventoryItem
 * @property {string} productId
 * @property {string} productName
 * @property {string} batchId
 * @property {number} stockQuantity
 * @property {number} lowStockThreshold
 * @property {string|null} expiresAt
 * @property {string|null} updatedAt
 */
export const createInventoryItem = (raw = {}) => ({
  productId: toStr(pick(raw, 'productId', 'product_id', 'id')),
  productName: toStr(pick(raw, 'productName', 'product_name', 'name')),
  batchId: toStr(pick(raw, 'batchId', 'batch_id')),
  stockQuantity: toInt(pick(raw, 'stockQuantity', 'stock_quantity', 'stock')),
  lowStockThreshold: toInt(pick(raw, 'lowStockThreshold', 'low_stock_threshold'), 5),
  expiresAt: toIsoDate(pick(raw, 'expiresAt', 'expires_at')),
  updatedAt: toIsoDate(pick(raw, 'updatedAt', 'updated_at')),
});

export const createInventoryList = listOf(createInventoryItem);

export const isBelowThreshold = (item) => item.stockQuantity <= item.lowStockThreshold;

/** Whole days until expiry; null when there is no expiry date. */
export const daysUntilExpiry = (item, now = new Date()) => {
  if (!item.expiresAt) return null;
  return Math.ceil((new Date(item.expiresAt).getTime() - now.getTime()) / 86_400_000);
};

/** { productId: stockQuantity } lookup for catalog screens. */
export const stockByProductId = (items = []) =>
  Object.fromEntries(items.map((i) => [i.productId, i.stockQuantity]));
