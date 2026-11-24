import orderService from '../services/order.service.js';
import { queueOrderReceipt } from '../services/receiptEmail.js';
import { success, error } from '../../utils/response.js';

/**
 * Order Controller
 */
class OrderController {
  async placeOrder(req, res) {
    try {
      const customerId = req.headers['x-user-id'] || req.body.customerId;
      const customerPhone = req.headers['x-user-phone'] || req.body.customerPhone || req.body.shippingAddress?.phone;

      if (!customerId) {
        return error(res, 'Authentication required to place an order', 401);
      }

      const { items, totalAmount, shippingAddress, paymentId, paymentStatus, status } = req.body;

      const order = await orderService.createOrder({
        customerId,
        customerPhone,
        items,
        totalAmount,
        shippingAddress,
        paymentId,
        paymentStatus,
        status
      });

      // Receipt goes to the email the customer signed up with (from the verified token via the gateway)
      const json = order.toJSON();
      let notification = { status: 'skipped', reason: 'Order is not paid' };
      if (String(json.status).toLowerCase() === 'paid' || ['paid', 'completed'].includes(String(json.paymentStatus).toLowerCase())) {
        let customerName = '';
        try {
          customerName = decodeURIComponent(req.headers['x-user-name'] || '');
        } catch {
          customerName = '';
        }
        notification = queueOrderReceipt({
          to: req.headers['x-user-email'],
          customerName: customerName || req.body.customerName,
          order: json
        });
      }

      return success(res, { ...json, notification }, 'Order created successfully', 201);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  async getMyOrders(req, res) {
    try {
      const customerId = req.headers['x-user-id'];
      if (!customerId) {
        return error(res, 'Authentication required', 401);
      }

      const orders = await orderService.getCustomerOrders(customerId);
      return success(res, orders.map(o => o.toJSON()), 'Customer orders retrieved');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getAllOrders(req, res) {
    try {
      const orders = await orderService.getAllOrders();
      return success(res, orders.map(o => o.toJSON()), 'All orders retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async getOrderById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'];
      const userRole = req.headers['x-user-role'];

      const order = await orderService.getOrderById(id, userId, userRole);
      return success(res, order.toJSON(), 'Order details retrieved');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return error(res, 'New status string is required', 400);
      }

      const updated = await orderService.updateOrderStatus(id, status);
      return success(res, updated.toJSON(), `Order status updated to ${status}`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'];
      const userRole = req.headers['x-user-role'];

      const cancelled = await orderService.cancelOrder(id, userId, userRole);
      return success(res, cancelled.toJSON(), 'Order cancelled successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }
}

export default new OrderController();
