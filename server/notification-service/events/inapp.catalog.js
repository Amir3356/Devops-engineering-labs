/**
 * In-app notification catalogue: which Kafka event becomes which notification, for whom.
 *
 * Adding a notification = adding one entry here (no consumer changes). Each entry receives the
 * event payload (and the full event) and returns { userId, title, message, type, category, data },
 * or null to skip. `type` picks the icon in the client (order | success | alert | security | info);
 * `category` groups notifications (future: per-category user preferences).
 */

const shortId = (id) => (id ? `#${String(id).slice(-8).toUpperCase()}` : '');
const money = (n) =>
  Number.isFinite(Number(n)) ? ` (total ${Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })})` : '';

const order = (p, event) => ({ orderId: p.orderId || event.aggregateId });

export const INAPP_CATALOG = {
  OrderPlaced: (p, event) => ({
    userId: p.customerId,
    title: 'Order received',
    message: `We received your order ${shortId(p.orderId)}${money(p.totalAmount)} and are confirming stock.`,
    type: 'order',
    category: 'orders',
    data: order(p, event)
  }),

  OrderConfirmed: (p, event) => ({
    userId: p.customerId,
    title: 'Order confirmed',
    message: `Good news — order ${shortId(p.orderId)} is confirmed and being prepared.`,
    type: 'success',
    category: 'orders',
    data: order(p, event)
  }),

  OrderRejected: (p, event) => ({
    userId: p.customerId,
    title: 'Order could not be completed',
    message: `Order ${shortId(p.orderId)} was not accepted${p.reason ? `: ${p.reason}` : ' because an item is out of stock'}.`,
    type: 'alert',
    category: 'orders',
    data: order(p, event)
  }),

  OrderCancelled: (p, event) => ({
    userId: p.customerId,
    title: 'Order cancelled',
    message: `Order ${shortId(p.orderId)} has been cancelled.`,
    type: 'info',
    category: 'orders',
    data: order(p, event)
  }),

  OrderStatusChanged: (p, event) =>
    p.status
      ? {
          userId: p.customerId,
          title: `Order ${String(p.status).toLowerCase()}`,
          message: `Order ${shortId(p.orderId)} is now ${p.status}.`,
          type: 'order',
          category: 'orders',
          data: { ...order(p, event), status: p.status }
        }
      : null
};
