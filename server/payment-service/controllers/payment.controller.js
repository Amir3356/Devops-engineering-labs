import paymentService from '../services/payment.service.js';
import { success, error } from '../../utils/response.js';

/**
 * Payment Controller
 */
class PaymentController {
  async processPayment(req, res) {
    try {
      const customerId = req.headers['x-user-id'] || req.body.customerId;
      if (!customerId) {
        return error(res, 'Authentication required to make payment', 401);
      }

      const { orderId, amount, paymentMethod, simulateFailure } = req.body;

      const payment = await paymentService.processPayment({
        orderId,
        customerId,
        amount,
        paymentMethod,
        simulateFailure
      });

      const message = payment.status === 'Success' 
        ? 'Payment processed successfully' 
        : 'Payment declined / failed simulation';

      const statusCode = payment.status === 'Success' ? 200 : 402;
      return res.status(statusCode).json({
        success: payment.status === 'Success',
        message,
        data: payment.toJSON(),
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  async getMyPayments(req, res) {
    try {
      const customerId = req.headers['x-user-id'];
      if (!customerId) {
        return error(res, 'Authentication required', 401);
      }

      const payments = await paymentService.getCustomerPayments(customerId);
      return success(res, payments.map(p => p.toJSON()), 'Customer payment records retrieved');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getAllRecords(req, res) {
    try {
      const payments = await paymentService.getAllPaymentRecords();
      return success(res, payments.map(p => p.toJSON()), 'All payment records retrieved');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getSalesReport(req, res) {
    try {
      const report = await paymentService.getSalesReport();
      return success(res, report, 'Sales analytics report generated');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getPaymentById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'];
      const userRole = req.headers['x-user-role'];

      const payment = await paymentService.getPaymentById(id, userId, userRole);
      return success(res, payment.toJSON(), 'Payment details retrieved');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }
}

export default new PaymentController();
