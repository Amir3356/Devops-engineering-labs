import orderRepository from '../repositories/order.repository.js';
import OrderModel from '../models/order.model.js';

/**
 * Order Domain Service
 */
class OrderService {
  async createOrder({ customerId, customerPhone, items, totalAmount, shippingAddress, paymentId, paymentStatus, status }) {
    OrderModel.validate({ items, totalAmount });

    const order = await orderRepository.create({
      customerId,
      customerPhone,
      items,
      totalAmount,
      shippingAddress,
      status: status || 'Pending',
      paymentId: paymentId || null,
      paymentStatus: paymentStatus || 'Pending'
    });

    return order;
  }

  async getOrderById(id, requestingUserId, requestingRole) {
    const order = await orderRepository.findById(id);
    if (!order) {
      throw new Error(`Order with ID ${id} not found`);
    }

    // Role-based access control
    if (requestingRole !== 'admin' && order.customerId !== requestingUserId) {
      throw new Error('Access denied: You do not have permission to view this order');
    }

    return order;
  }

  async getCustomerOrders(customerId) {
    return orderRepository.findByCustomerId(customerId);
  }

  async getAllOrders() {
    return orderRepository.findAll();
  }

  async updateOrderStatus(id, newStatus) {
    const validStatuses = ['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Allowed: ${validStatuses.join(', ')}`);
    }

    const updated = await orderRepository.updateStatus(id, newStatus);
    if (!updated) {
      throw new Error(`Order with ID ${id} not found`);
    }

    return updated;
  }

  async cancelOrder(id, requestingUserId, requestingRole) {
    const order = await orderRepository.findById(id);
    if (!order) {
      throw new Error(`Order with ID ${id} not found`);
    }

    if (requestingRole !== 'admin' && order.customerId !== requestingUserId) {
      throw new Error('Access denied: You can only cancel your own orders');
    }

    if (order.status === 'Cancelled') {
      throw new Error('Order is already cancelled');
    }

    if (order.status === 'Delivered') {
      throw new Error('Cannot cancel an order that has already been delivered');
    }

    return orderRepository.cancelOrder(id);
  }
}

export default new OrderService();
