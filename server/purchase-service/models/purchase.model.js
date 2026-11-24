export default class PurchaseModel {
  constructor({
    id,
    batchId,
    productName,
    category,
    quantity,
    supplier,
    unitCost,
    totalCost,
    status,
    createdAt
  }) {
    this.id = id;
    this.batchId = batchId;
    this.productName = productName;
    this.category = category || 'General';
    this.quantity = parseInt(quantity, 10) || 1;
    this.supplier = supplier || '';
    this.unitCost = parseFloat(unitCost) || 0.0;
    this.totalCost = parseFloat(totalCost) || (this.unitCost * this.quantity);
    this.status = status || 'Paid';
    this.createdAt = createdAt || new Date().toISOString();
  }
}
