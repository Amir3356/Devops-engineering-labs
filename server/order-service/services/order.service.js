import orderRepository from '../repositories/order.repository.js';
import OrderModel from '../models/order.model.js';
import pool from '../config/db.js';
import { withTransaction, appendEvent } from '../../utils/events/index.js';

/**
 * Order Domain Service — order saga (choreography over Kafka)
 *
 *   POST /orders (paid) ─▶ orders.status = AwaitingStock  + OrderPlaced      (one transaction)
 *   inventory-service   ─▶ deducts atomically             + StockReserved | StockRejected
 *   this service        ─▶ AwaitingStock → Paid           + OrderConfirmed  (receipt email)
 *                          AwaitingStock → Rejected       + OrderRejected   (payment refunded)
 *   cancel              ─▶ Cancelled                      + OrderCancelled  (inventory restores stock)
 *
 * The order row is saved first, so there is no compensating HTTP call that can fail
 * halfway: if inventory is down, OrderPlaced simply waits in Kafka.
 */

const AGGREGATE = 'order';
export const AWAITING_STOCK = 'AwaitingStock';
export const REJECTED = 'Rejected';

const isPaidRequest = (status, paymentStatus) =>
  String(status || '').toLowerCase() === 'paid' ||
  ['paid', 'completed'].includes(String(paymentStatus || '').toLowerCase());

/** Orders whose units were taken out of inventory (saga-reserved, or paid before the saga existed). */
const STOCK_HELD_STATUSES = new Set(['Paid', 'Processing', 'Shipped']);
const holdsStock = (order) => STOCK_HELD_STATUSES.has(order.status);

const ADMIN_STATUSES = ['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const itemRefs = (items) => items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }));

function cancelledEvent(order, previous) {
  return {
    aggregateType: AGGREGATE,
    aggregateId: order.id,
    type: 'OrderCancelled',
    payload: {
      orderId: order.id,
      customerId: order.customerId,
      previousStatus: previous.status,
      // inventory-service puts the units back only when this is true
      stockDeducted: holdsStock(previous),
      items: itemRefs(order.items)
    }
  };
}

class OrderService {
  /**
   * Paid orders start the saga and come back as AwaitingStock; unpaid ones are saved as Pending.
   * @param {{email?: string|null, name?: string}} [input.customer] receipt contact
   */
  async createOrder({ customerId, customerPhone, items, totalAmount, shippingAddress, paymentId, paymentStatus, status, customer = {}, idempotencyKey = null }) {
    OrderModel.validate({ items, totalAmount });

    // Same checkout submitted again (double-click, network retry): return the original order
    if (idempotencyKey) {
      const existing = await orderRepository.findByIdempotencyKey(customerId, idempotencyKey);
      if (existing) return Object.assign(existing, { replayed: true });
    }

    // Keep only the fields the order needs, including the category for "My Orders"
    const orderItems = items.map((i) => ({
      productId: i.productId,
      title: i.title || '',
      category: i.category || '',
      price: Number(i.price),
      quantity: Number(i.quantity),
      subtotal: Math.round(Number(i.price) * Number(i.quantity) * 100) / 100
    }));
    if (orderItems.some((i) => !i.productId || !(i.quantity > 0))) {
      throw new Error('Each item needs a productId and a positive quantity');
    }

    const paid = isPaidRequest(status, paymentStatus);

    try {
      return await this.insertOrderWithEvent({ customerId, customerPhone, orderItems, totalAmount, shippingAddress, paymentId, paymentStatus, status, customer, idempotencyKey, paid });
    } catch (err) {
      // Two identical submits raced past the check above: the unique index let only one in
      if (idempotencyKey && err.code === '23505') {
        const existing = await orderRepository.findByIdempotencyKey(customerId, idempotencyKey);
        if (existing) return Object.assign(existing, { replayed: true });
      }
      throw err;
    }
  }

  insertOrderWithEvent({ customerId, customerPhone, orderItems, totalAmount, shippingAddress, paymentId, paymentStatus, status, customer, idempotencyKey, paid }) {
    // The order row and its OrderPlaced event commit together (transactional outbox)
    return withTransaction(pool, async (client) => {
      const order = await orderRepository.create(
        {
          customerId,
          customerPhone,
          items: orderItems,
          totalAmount,
          shippingAddress,
          // Payment is authorised; it becomes Completed once inventory reserves the units
          status: paid ? AWAITING_STOCK : status || 'Pending',
          paymentId: paymentId || null,
          paymentStatus: paid ? 'Authorized' : paymentStatus || 'Pending',
          customerEmail: customer.email || null,
          customerName: customer.name || '',
          idempotencyKey
        },
        client
      );
      await appendEvent(client, {
        aggregateType: AGGREGATE,
        aggregateId: order.id,
        type: 'OrderPlaced',
        payload: {
          orderId: order.id,
          customerId: order.customerId,
          items: itemRefs(order.items),
          totalAmount: order.totalAmount,
          status: order.status,
          // inventory-service only reserves stock for events that ask for it
          stockRequested: paid,
          createdAt: order.createdAt
        }
      });
      return order;
    });
  }

  /** Saga reply from inventory-service: the units are reserved. */
  async confirmStockReserved(orderId, { client }) {
    const order = await orderRepository.findByIdForUpdate(orderId, client);
    if (!order) throw new Error(`StockReserved for unknown order ${orderId}`);

    if (order.status !== AWAITING_STOCK) {
      // Shouldn't happen (cancel is blocked while awaiting stock), but never strand reserved units
      console.warn(`[Order Saga] StockReserved for ${orderId} in status ${order.status}; asking inventory to release it`);
      await appendEvent(client, {
        aggregateType: AGGREGATE,
        aggregateId: order.id,
        type: 'OrderCancelled',
        payload: {
          orderId: order.id,
          customerId: order.customerId,
          previousStatus: order.status,
          stockDeducted: true,
          items: itemRefs(order.items)
        }
      });
      return;
    }

    const confirmed = await orderRepository.transition(orderId, { status: 'Paid', paymentStatus: 'Completed' }, client);
    await appendEvent(client, {
      aggregateType: AGGREGATE,
      aggregateId: confirmed.id,
      type: 'OrderConfirmed',
      payload: {
        orderId: confirmed.id,
        customerId: confirmed.customerId,
        items: confirmed.items,
        totalAmount: confirmed.totalAmount,
        status: confirmed.status,
        paymentStatus: confirmed.paymentStatus,
        createdAt: confirmed.createdAt,
        customer: { email: confirmed.customerEmail, name: confirmed.customerName }
      }
    });
  }

  /** Saga reply from inventory-service: not enough stock, nothing was deducted. */
  async rejectForStock(orderId, reason, { client }) {
    const order = await orderRepository.findByIdForUpdate(orderId, client);
    if (!order) throw new Error(`StockRejected for unknown order ${orderId}`);
    if (order.status !== AWAITING_STOCK) {
      console.warn(`[Order Saga] Ignoring StockRejected for ${orderId} in status ${order.status}`);
      return;
    }

    // Payment is simulated, so a rejected order is simply marked refunded
    const rejected = await orderRepository.transition(
      orderId,
      { status: REJECTED, paymentStatus: 'Refunded', statusReason: reason || 'Not enough stock' },
      client
    );
    await appendEvent(client, {
      aggregateType: AGGREGATE,
      aggregateId: rejected.id,
      type: 'OrderRejected',
      payload: { orderId: rejected.id, customerId: rejected.customerId, reason: rejected.statusReason }
    });
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
    if (!ADMIN_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Allowed: ${ADMIN_STATUSES.join(', ')}`);
    }

    return withTransaction(pool, async (client) => {
      const current = await orderRepository.findByIdForUpdate(id, client);
      if (!current) {
        throw new Error(`Order with ID ${id} not found`);
      }
      if (current.status === AWAITING_STOCK) {
        throw Object.assign(new Error('This order is still waiting for its stock to be confirmed'), { status: 409 });
      }
      if (current.status === REJECTED || current.status === 'Cancelled') {
        throw Object.assign(new Error(`A ${current.status.toLowerCase()} order can't be changed`), { status: 409 });
      }

      const updated = await orderRepository.updateStatus(id, newStatus, null, null, client);
      // Cancelling through the admin status menu must return the units too
      await appendEvent(
        client,
        newStatus === 'Cancelled'
          ? cancelledEvent(updated, current)
          : {
              aggregateType: AGGREGATE,
              aggregateId: updated.id,
              type: 'OrderStatusChanged',
              payload: { orderId: updated.id, customerId: updated.customerId, status: updated.status }
            }
      );
      return updated;
    });
  }

  async cancelOrder(id, requestingUserId, requestingRole) {
    return withTransaction(pool, async (client) => {
      const order = await orderRepository.findByIdForUpdate(id, client);
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
      if (order.status === REJECTED) {
        throw new Error('This order was rejected and has already been refunded');
      }
      if (order.status === AWAITING_STOCK) {
        throw Object.assign(new Error('This order is still being confirmed. Try again in a moment.'), { status: 409 });
      }

      const cancelled = await orderRepository.cancelOrder(id, client);
      await appendEvent(client, cancelledEvent(cancelled, order));
      return cancelled;
    });
  }
}

export default new OrderService();
