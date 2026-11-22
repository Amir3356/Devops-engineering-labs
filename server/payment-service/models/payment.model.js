import crypto from 'crypto';

/**
 * Payment Model / Domain Entity
 */
class PaymentModel {
  constructor({
    id,
    orderId,
    customerId,
    amount,
    currency,
    paymentMethod,
    status,
    transactionRef,
    createdAt
  }) {
    this.id = id || `pay-${crypto.randomUUID().slice(0, 8)}`;
    this.orderId = orderId;
    this.customerId = customerId;
    this.amount = parseFloat(amount) || 0;
    this.currency = currency || 'USD';
    this.paymentMethod = paymentMethod || 'Card'; // 'Card', 'Telebirr', 'CBE Birr', 'Cash on Delivery'
    this.status = status || 'Success'; // 'Success', 'Failed', 'Pending', 'Refunded'
    this.transactionRef = transactionRef || `tx-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    this.createdAt = createdAt || new Date().toISOString();
  }

  static validate(data) {
    if (!data.orderId) {
      throw new Error('Order ID is required to process payment');
    }
    if (data.amount === undefined || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
      throw new Error('Valid positive payment amount is required');
    }
  }

  toJSON() {
    return {
      id: this.id,
      paymentId: this.id,
      orderId: this.orderId,
      customerId: this.customerId,
      amount: this.amount,
      currency: this.currency,
      paymentMethod: this.paymentMethod,
      status: this.status,
      transactionRef: this.transactionRef,
      createdAt: this.createdAt
    };
  }
}

export default PaymentModel;
