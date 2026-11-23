export default class SaleModel {
  constructor({
    id,
    saleId,
    batchId,
    productId,
    productName,
    category,
    quantity,
    unitPrice,
    totalAmount,
    customerName,
    customerEmail,
    customerPhone,
    paymentStatus,
    fulfillmentStatus,
    createdAt
  }) {
    this.id = id;
    this.saleId = saleId || id;
    this.batchId = batchId || '';
    this.productId = productId || '';
    this.productName = productName;
    this.category = category || 'General';
    this.quantity = parseInt(quantity, 10) || 1;
    this.unitPrice = parseFloat(unitPrice) || 0.0;
    this.totalAmount = parseFloat(totalAmount) || (this.unitPrice * this.quantity);
    this.customerName = customerName || 'Direct Customer';
    this.customerEmail = customerEmail || '';
    this.customerPhone = customerPhone || '';
    this.paymentStatus = paymentStatus || 'Paid';
    this.fulfillmentStatus = fulfillmentStatus || 'Delivered';
    this.createdAt = createdAt || new Date().toISOString();
  }
}
