import orderService from '../services/order.service.js';
import { startConsumer, TOPICS } from '../../utils/events/index.js';

/**
 * Order saga: inventory-service's replies to OrderPlaced.
 * Each handler runs in the same transaction as the inbox insert, and writes its
 * follow-up event (OrderConfirmed / OrderRejected) to the outbox in that transaction.
 */
const handlers = {
  StockReserved: ({ payload }, ctx) => orderService.confirmStockReserved(payload.orderId, ctx),
  StockRejected: ({ payload }, ctx) => orderService.rejectForStock(payload.orderId, payload.reason, ctx)
};

export function startInventoryConsumer(pool) {
  return startConsumer({
    pool,
    serviceName: 'order-service',
    groupId: 'order-service',
    topics: [TOPICS.INVENTORY],
    handlers
  });
}
