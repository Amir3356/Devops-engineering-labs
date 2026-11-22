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
    createdAt,
    updatedAt
  }) {
    this.id = id || `ord-${crypto.randomUUID().slice(0, 8)}`;
    this.customerId = customerId;
    this.customerPhone = customerPhone || '';
    this.items = Array.isArray(items) ? items : [];
    this.totalAmount = parseFloat(totalAmount) || 0;
    this.shippingAddress = shippingAddress || {};
    this.status = status || 'Pending'; // 'Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'
    this.paymentId = paymentId || null;
    this.paymentStatus = paymentStatus || 'Pending';
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export default OrderModel;
