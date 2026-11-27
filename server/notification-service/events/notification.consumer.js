import { startConsumer, TOPICS } from '../../utils/events/index.js';
import { enqueueEmail } from '../queues/email.queue.js';
import notificationService from '../services/notification.service.js';
import { INAPP_CATALOG } from './inapp.catalog.js';

/**
 * Turns order/sale events (Kafka) into notifications on two channels:
 *
 *   Kafka event ─▶ this consumer (inbox dedupe, one DB transaction)
 *                   ├─▶ in-app: notifications row (catalogue in inapp.catalog.js) ─▶ after commit:
 *                   │           Redis pub/sub ─▶ gateway ─▶ the customer's WebSocket (bell badge)
 *                   └─▶ email:  "emails" queue (receipts) ─▶ email worker ─▶ SMTP
 *
 * Handlers only write a row / enqueue, so they finish in milliseconds; retries, backoff and rate
 * limiting of the SMTP send are the queue's job. Both channels are idempotent (notification key =
 * eventId:userId, email job id = eventId), so a redelivered event creates nothing twice. If a step
 * throws, the transaction (inbox row + notification) rolls back and Kafka retries (then DLQ).
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isPaid = (p) =>
  String(p.status || '').toLowerCase() === 'paid' ||
  ['paid', 'completed'].includes(String(p.paymentStatus || '').toLowerCase());

// Email channel: receipts only for paid/confirmed orders and recorded sales
const emailHandlers = {
  async OrderConfirmed({ eventId, payload: p }) {
    const to = p.customer?.email;
    if (!isPaid(p) || !EMAIL.test(String(to || ''))) return;
    await enqueueEmail(
      'order-receipt',
      {
        to,
        customerName: p.customer?.name,
        orderId: p.orderId,
        items: p.items,
        totalAmount: p.totalAmount,
        createdAt: p.createdAt
      },
      eventId
    );
  },

  async SaleRecorded({ eventId, payload: p }) {
    const to = p.customer?.email;
    if (!EMAIL.test(String(to || ''))) return;
    await enqueueEmail(
      'sale-receipt',
      {
        to,
        customerName: p.customer?.name,
        saleId: p.saleId,
        productName: p.productName,
        category: p.category,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        totalAmount: p.totalAmount,
        createdAt: p.createdAt
      },
      eventId
    );
  }
};

// Every event type with an in-app entry and/or an email handler
const handlers = Object.fromEntries(
  [...new Set([...Object.keys(INAPP_CATALOG), ...Object.keys(emailHandlers)])].map((type) => [
    type,
    async (event, ctx) => {
      await notificationService.createFromEvent(event, ctx);
      if (emailHandlers[type]) await emailHandlers[type](event, ctx);
    }
  ])
);

export function startNotificationConsumer(pool) {
  return startConsumer({
    pool,
    serviceName: 'notification-service',
    groupId: 'notification-service',
    topics: [TOPICS.ORDER, TOPICS.SALE],
    handlers
  });
}
