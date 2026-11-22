import paymentRepository from '../repositories/payment.repository.js';
import PaymentModel from '../models/payment.model.js';

/**
 * Payment Domain Service
 */
class PaymentService {
  async processPayment({ orderId, customerId, amount, paymentMethod, simulateFailure }) {
    PaymentModel.validate({ orderId, amount });

    const status = simulateFailure ? 'Failed' : 'Success';

    const payment = await paymentRepository.create({
      orderId,
      customerId,
      amount,
      currency: 'USD',
      paymentMethod: paymentMethod || 'Card',
      status
    });

    return payment;
  }

  async getPaymentById(id, requestingUserId, requestingRole) {
    const payment = await paymentRepository.findById(id);
    if (!payment) {
      throw new Error(`Payment with ID ${id} not found`);
    }

    if (requestingRole !== 'admin' && payment.customerId !== requestingUserId) {
      throw new Error('Access denied: You do not have permission to view this payment record');
    }

    return payment;
  }

  async getCustomerPayments(customerId) {
    return paymentRepository.findByCustomerId(customerId);
  }

  async getAllPaymentRecords() {
    return paymentRepository.findAll();
  }

  async getSalesReport() {
    return paymentRepository.getSalesReport();
  }
}

export default new PaymentService();
