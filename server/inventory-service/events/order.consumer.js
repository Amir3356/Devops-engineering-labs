import inventoryRepository from '../repositories/inventory.repository.js';
import { invalidate } from '../../utils/cache.js';
import { startConsumer, appendEvent, TOPICS } from '../../utils/events/index.js';

/**
 * Inventory's side of the order saga.
 *
 *  OrderPlaced (stockRequested)  → deduct every item atomically → StockReserved | StockRejected
 *  OrderCancelled (stockDeducted) → put the units back          → StockRestored
 *
 * Stock changes, the inbox row and the reply event share one transaction, so a reply is
 * published exactly when the stock really changed. Replies are keyed by order id
 * (inventory.events) so all replies for an order stay in order.
 */

const AGGREGATE = 'inventory';
const clearStockCache = () => invalidate('stock');

const handlers = {
  async OrderPlaced({ payload }, { client, afterCommit }) {
    // Unpaid orders, and events from before the saga (stock already deducted over HTTP), are skipped
    if (!payload.stockRequested) return;
    const items = (payload.items || []).map((i) => ({ productId: i.productId, quantity: parseInt(i.quantity, 10) }));

    await client.query('SAVEPOINT reserve_stock');
    try {
      await inventoryRepository.deductMany(items, client);
      await client.query('RELEASE SAVEPOINT reserve_stock');
    } catch (err) {
      if (err.code !== 'INSUFFICIENT_STOCK') throw err; // infrastructure problem → retry
      // Undo any items already deducted for this order, then tell the order it can't be filled
      await client.query('ROLLBACK TO SAVEPOINT reserve_stock');
      await appendEvent(client, {
        aggregateType: AGGREGATE,
        aggregateId: payload.orderId,
        type: 'StockRejected',
        payload: { orderId: payload.orderId, reason: err.message, items }
      });
      console.log(`[Inventory Saga] Rejected ${payload.orderId}: ${err.message}`);
      return;
    }

    await appendEvent(client, {
      aggregateType: AGGREGATE,
      aggregateId: payload.orderId,
      type: 'StockReserved',
      payload: { orderId: payload.orderId, items }
    });
    afterCommit(clearStockCache);
    console.log(`[Inventory Saga] Reserved stock for ${payload.orderId}`);
  },

  async OrderCancelled({ payload }, { client, afterCommit }) {
    if (!payload.stockDeducted) return;
    const restored = [];
    const missing = [];
    const items = payload.items || [];
    // Take all row locks up front in the same global order as deductions (no deadlock)
    await inventoryRepository.lockRowsInOrder(items.map((i) => i.productId), client);
    for (const item of items) {
      const qty = parseInt(item.quantity, 10);
      if (!(qty > 0)) continue;
      const row = await inventoryRepository.replenishStock(item.productId, qty, client);
      // The product's stock row was deleted since the order; nothing to put back into
      (row ? restored : missing).push({ productId: item.productId, quantity: qty });
    }
    if (missing.length) {
      console.warn(`[Inventory Saga] ${payload.orderId}: no stock row for ${missing.map((m) => m.productId).join(', ')}`);
    }

    await appendEvent(client, {
      aggregateType: AGGREGATE,
      aggregateId: payload.orderId,
      type: 'StockRestored',
      payload: { orderId: payload.orderId, items: restored, missing }
    });
    afterCommit(clearStockCache);
    console.log(`[Inventory Saga] Restored stock for cancelled order ${payload.orderId}`);
  }
};

export function startOrderConsumer(pool) {
  return startConsumer({
    pool,
    serviceName: 'inventory-service',
    groupId: 'inventory-service',
    topics: [TOPICS.ORDER],
    handlers
  });
}
