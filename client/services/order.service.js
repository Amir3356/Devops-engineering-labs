import { placeOrderApi, getOrderApi, getOrdersApi, getAllOrdersAdminApi, updateOrderStatusApi, cancelOrderApi } from '../api/order.api';
import { subscribeRealtime } from './realtime.service';

export const AWAITING_STOCK = 'AwaitingStock';
const CONFIRM_TIMEOUT_MS = 15000;
const POLL_MS = 1500;

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
   * Wait for the order saga to settle: inventory reserves the stock (-> Paid) or rejects it
   * (-> Rejected, payment refunded). Wakes up on the gateway's WebSocket hint for this order
   * and polls as a fallback. Resolves with the latest order, still AwaitingStock on timeout.
   */
  waitForConfirmation(order, timeoutMs = CONFIRM_TIMEOUT_MS) {
    const orderId = order.id || order.orderId;
    return new Promise((resolve) => {
      let latest = order;
      let done = false;
      let checking = false;
      let poll = null;
      let timer = null;
      let unsubscribe = () => {};
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(poll);
        clearTimeout(timer);
        unsubscribe();
        resolve(latest);
      };
      const check = async () => {
        if (done || checking) return;
        checking = true;
        try {
          const res = await getOrderApi(orderId);
          if (res?.success && res.data) latest = res.data;
          if (latest.status !== AWAITING_STOCK) finish();
        } catch {
          // transient network error: the next poll or event retries
        } finally {
          checking = false;
        }
      };
      unsubscribe = subscribeRealtime((event) => {
        if (event.type === 'connection.open' || (event.type === 'orders.updated' && event.orderId === orderId)) check();
      });
      poll = setInterval(check, POLL_MS);
      timer = setTimeout(finish, timeoutMs);
      check();
    });
  }

  /**
   * Place a paid order. order-service accepts it as AwaitingStock and inventory confirms it
   * asynchronously (order saga). Throws when the order is rejected for stock.
   * @returns the settled order; `status` is still AwaitingStock if confirmation is slow
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
    if (res.data?.status !== AWAITING_STOCK) return res.data;

    const settled = await this.waitForConfirmation(res.data);
    if (settled.status === 'Rejected') {
      // Typically another customer bought the last units a moment earlier (inventory row lock)
      const err = new Error(`${settled.statusReason || 'Not enough stock'}. Your payment was refunded.`);
      err.code = 'SOLD_OUT';
      throw err;
    }
    // Keep the receipt info from the placement response (the GET doesn't include it)
    return { ...settled, notification: res.data.notification };
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
