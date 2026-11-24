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
 * @property {number} unitCost
 * @property {number} totalCost
 * @property {string|null} createdAt
 */
export const createPurchase = (raw = {}) => ({
  id: toStr(pick(raw, 'id', 'purchaseId', 'purchase_id')),
  batchId: toStr(pick(raw, 'batchId', 'batch_id')),
  productName: toStr(pick(raw, 'productName', 'product_name')),
  category: toStr(pick(raw, 'category')),
  quantity: toInt(pick(raw, 'quantity')),
  supplier: toStr(pick(raw, 'supplier', 'supplierName', 'supplier_name')),
  unitCost: Number(pick(raw, 'unitCost', 'unit_cost', 'unitPurchasePrice', 'unit_purchase_price')) || 0,
  totalCost: Number(pick(raw, 'totalCost', 'total_cost', 'totalPurchaseCost', 'total_purchase_cost')) || 0,
  createdAt: toIsoDate(pick(raw, 'createdAt', 'created_at')),
});

export const createPurchaseList = listOf(createPurchase);

export const emptyPurchaseForm = (productName = '', category = '') => ({
  batchId: '',
  productName,
  category,
  quantity: '',
  supplier: '',
  totalCost: '',
});

export const purchaseToForm = (purchase) => ({
  batchId: purchase.batchId,
  productName: purchase.productName,
  category: purchase.category,
  quantity: String(purchase.quantity || ''),
  supplier: purchase.supplier,
  totalCost: purchase.totalCost ? String(purchase.totalCost) : '',
});

export const purchaseFormToApi = (form) => ({
  productName: toStr(form.productName),
  category: toStr(form.category),
  quantity: toInt(form.quantity),
  supplier: toStr(form.supplier),
  unitCost: form.unitCost ? Number(form.unitCost) : 0,
  totalCost: form.totalCost ? Number(form.totalCost) : 0,
});
