import { placeOrderApi, getOrdersApi, getAllOrdersAdminApi, updateOrderStatusApi, cancelOrderApi } from '../api/order.api';

// Older versions cached orders in the browser; those copies were never on the server.
const LEGACY_ORDERS_KEY = 'ecommerce_orders';
try {
  localStorage.removeItem(LEGACY_ORDERS_KEY);
} catch {
  // storage unavailable — nothing to clean up
}

const listFrom = (res) => (res?.success && Array.isArray(res.data) ? res.data : []);

/**
 * Order Business Logic Service (Frontend)
 * Thin layer over /api/orders. Every method reflects what order-service stored;
 * failures are thrown so the UI never shows an order the server doesn't have.
 */
class OrderService {
  /** Kept for older callers; orders are no longer cached in the browser. */
  getStoredOrders() {
    return [];
  }

  /** The signed-in customer's orders. */
  async fetchOrders() {
    return listFrom(await getOrdersApi());
  }

  /** Every order (admin only). */
  async fetchAllAdminOrders() {
    return listFrom(await getAllOrdersAdminApi());
  }

  /**
   * Save a paid order. order-service takes the units out of inventory first and
   * rejects the order (nothing saved, nothing charged) when stock is short.
   * @returns the order as stored by the server
   */
  async recordCompletedOrder(order, paymentId) {
    const res = await placeOrderApi({
      ...order,
      status: 'Paid',
      paymentId: paymentId || order.paymentId || `pay-${Date.now().toString().slice(-6)}`,
      paymentStatus: 'Completed'
    });
    if (!res?.success) {
      throw new Error(res?.message || 'The order could not be saved');
    }
    return res.data;
  }

  async cancelOrder(orderId) {
    await cancelOrderApi(orderId);
    return this.fetchOrders();
  }

  async updateOrderStatus(orderId, newStatus) {
    await updateOrderStatusApi(orderId, newStatus);
    return this.fetchAllAdminOrders();
  }
}

export default new OrderService();
