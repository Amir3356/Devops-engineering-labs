import { startConsumer, TOPICS } from '../../utils/events/index.js';
import { enqueueEmail } from '../queues/email.queue.js';

/**
 * Turns order/sale events (Kafka) into receipt-email jobs (Redis / BullMQ).
 * Orders are emailed on OrderConfirmed (stock reserved, payment completed), not OrderPlaced.
 *
 *   Kafka event ─▶ this consumer (inbox dedupe) ─▶ "emails" queue ─▶ email worker ─▶ SMTP
 *
 * The handler only enqueues, so it finishes in milliseconds; retries, backoff and rate
 * limiting of the actual SMTP send are the queue's job. The job id is the event id, so a
 * redelivered event can't create a second email. If the queue Redis is down, enqueueing
 * throws and the Kafka consumer retries the event (then DLQ), so nothing is dropped.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isPaid = (p) =>
  String(p.status || '').toLowerCase() === 'paid' ||
  ['paid', 'completed'].includes(String(p.paymentStatus || '').toLowerCase());

const handlers = {
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

export function startReceiptConsumer(pool) {
  return startConsumer({
    pool,
    serviceName: 'notification-service',
    groupId: 'notification-service',
    topics: [TOPICS.ORDER, TOPICS.SALE],
    handlers
  });
}
