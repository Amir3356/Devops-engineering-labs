import crypto from 'crypto';

/**
 * Order Model / Domain Entity
 */
class OrderModel {
  constructor({
    id,
    customerId,
    customerPhone,
    items,
    totalAmount,
    shippingAddress,
    status,
    paymentId,
    paymentStatus,
    customerEmail,
    customerName,
    statusReason,
    idempotencyKey,
    createdAt,
    updatedAt
  }) {
    this.id = id || `ord-${crypto.randomUUID().slice(0, 8)}`;
    this.customerId = customerId;
    this.customerPhone = customerPhone || '';
    this.items = Array.isArray(items) ? items : [];
    this.totalAmount = parseFloat(totalAmount) || 0;
    this.shippingAddress = shippingAddress || {};
    // 'Pending', 'AwaitingStock', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Rejected'
    this.status = status || 'Pending';
    this.paymentId = paymentId || null;
    this.paymentStatus = paymentStatus || 'Pending';
    // Receipt contact, kept so the OrderConfirmed event can carry it once stock is reserved
    this.customerEmail = customerEmail || null;
    this.customerName = customerName || '';
    // Why the order ended up Rejected (e.g. not enough stock)
    this.statusReason = statusReason || null;
    // Client-generated checkout id; unique per customer (duplicate submits return this order)
    this.idempotencyKey = idempotencyKey || null;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  static validate(data) {
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('Order must contain at least one product item');
    }

    if (data.totalAmount === undefined || isNaN(parseFloat(data.totalAmount)) || parseFloat(data.totalAmount) < 0) {
      throw new Error('Valid order total amount is required');
    }
  }

  toJSON() {
    return {
      id: this.id,
      orderId: this.id,
      customerId: this.customerId,
      customerPhone: this.customerPhone,
      items: this.items,
      totalAmount: this.totalAmount,
      shippingAddress: this.shippingAddress,
      status: this.status,
      paymentId: this.paymentId,
      paymentStatus: this.paymentStatus,
      statusReason: this.statusReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export default OrderModel;
