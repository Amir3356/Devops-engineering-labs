import { pick, toInt, toStr, toIsoDate, listOf } from './_fields';

/**
 * A procurement batch recorded by the admin.
 * @typedef {Object} Purchase
 * @property {string} id
 * @property {string} batchId
 * @property {string} productName
 * @property {string} category
 * @property {number} quantity
 * @property {string} supplier
 * @property {string|null} createdAt
 */
export const createPurchase = (raw = {}) => ({
  id: toStr(pick(raw, 'id', 'purchaseId', 'purchase_id')),
  batchId: toStr(pick(raw, 'batchId', 'batch_id')),
  productName: toStr(pick(raw, 'productName', 'product_name')),
  category: toStr(pick(raw, 'category')),
  quantity: toInt(pick(raw, 'quantity')),
  supplier: toStr(pick(raw, 'supplier')),
  createdAt: toIsoDate(pick(raw, 'createdAt', 'created_at')),
});

export const createPurchaseList = listOf(createPurchase);

export const emptyPurchaseForm = (productName = '', category = '') => ({
  batchId: '',
  productName,
  category,
  quantity: '',
  supplier: '',
});

export const purchaseToForm = (purchase) => ({
  batchId: purchase.batchId,
  productName: purchase.productName,
  category: purchase.category,
  quantity: String(purchase.quantity || ''),
  supplier: purchase.supplier,
});

export const purchaseFormToApi = (form) => ({
  productName: toStr(form.productName),
  category: toStr(form.category),
  quantity: toInt(form.quantity),
  supplier: toStr(form.supplier),
});
