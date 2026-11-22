import { placeOrderApi, getOrdersApi, getAllOrdersAdminApi, updateOrderStatusApi, cancelOrderApi } from '../api/order.api';

const ORDERS_KEY = 'ecommerce_orders';

/**
 * Order Business Logic Service (Frontend)
 * Coordinates pure HTTP calls to /api/orders with local state persistence.
 */
class OrderService {
  getStoredOrders() {
    try {
      const raw = localStorage.getItem(ORDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveOrders(orders) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }

  async fetchOrders() {
    try {
      const res = await getOrdersApi();
      if (res && res.success && Array.isArray(res.data)) {
        this.saveOrders(res.data);
        return res.data;
      }
    } catch {
      // Fallback to local persistence
    }
    return this.getStoredOrders();
  }

  async fetchAllAdminOrders() {
    try {
      const res = await getAllOrdersAdminApi();
      if (res && res.success && Array.isArray(res.data)) {
        return res.data;
      }
    } catch {
      // Fallback to local persistence
    }
    return this.getStoredOrders();
  }

  createOrderEnvelope(cartItems, totalAmount, shippingInfo, customerId) {
    const orderId = `ord-${Date.now().toString().slice(-6)}`;
    return {
      orderId,
      customerId: customerId || null,
      customerPhone: shippingInfo.phone,
      items: cartItems.map(item => ({
        productId: item.id,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
      })),
      totalAmount,
      shippingAddress: shippingInfo,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
  }

  async recordCompletedOrder(order, paymentId) {
    const completedOrder = { 
      ...order, 
      status: 'Paid', 
      paymentId,
      paymentStatus: 'Completed'
    };

    // Save optimistically to local storage
    const existing = this.getStoredOrders();
    const updated = [completedOrder, ...existing];
    this.saveOrders(updated);

    // Persist to PostgreSQL backend via API Gateway
    try {
      await placeOrderApi(completedOrder);
    } catch (err) {
      console.warn('[OrderService] Server persistence failed, saved locally:', err.message);
    }

    return updated;
  }

  async cancelOrder(orderId) {
    const existing = this.getStoredOrders();
    const updated = existing.map(ord => {
      if (ord.orderId === orderId || ord.id === orderId) {
        return {
          ...ord,
          status: 'Cancelled',
          cancelledAt: new Date().toISOString()
        };
      }
      return ord;
    });
    this.saveOrders(updated);

    try {
      await cancelOrderApi(orderId);
    } catch (err) {
      console.warn('[OrderService] Server cancel order sync failed:', err.message);
    }

    return updated;
  }

  async updateOrderStatus(orderId, newStatus) {
    const existing = this.getStoredOrders();
    const updated = existing.map(ord => {
      if (ord.orderId === orderId || ord.id === orderId) {
        return { ...ord, status: newStatus };
      }
      return ord;
    });
    this.saveOrders(updated);

    try {
      await updateOrderStatusApi(orderId, newStatus);
    } catch (err) {
      console.warn('[OrderService] Server update status sync failed:', err.message);
    }

    return updated;
  }
}

export default new OrderService();
