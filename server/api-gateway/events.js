import os from 'os';
import { getKafka, TOPICS } from '../utils/events/index.js';
import { broadcast } from './realtime.js';

/**
 * Event-driven real-time updates.
 *
 * Order status now changes asynchronously (the saga runs after the HTTP request returned),
 * so the gateway can't infer it from URLs any more. It listens to the domain events and
 * forwards a "something changed" hint to WebSocket clients, which reload via REST.
 *
 * Every gateway instance must see every event, so each uses its own consumer group and
 * starts at the latest offset (old events are irrelevant to connected browsers).
 */

const ORDER_EVENTS = new Set(['OrderPlaced', 'OrderConfirmed', 'OrderRejected', 'OrderCancelled', 'OrderStatusChanged']);
const STOCK_EVENTS = new Set(['StockReserved', 'StockRestored']);

const GROUP_ID = `api-gateway-realtime-${os.hostname()}`;

/**
 * Stop consuming and delete this instance's group. Each container gets a new hostname, so
 * without this every restart would leave a dead group behind (showing fake lag in Grafana).
 */
export async function stopRealtimeConsumer(consumer) {
  await consumer.disconnect().catch(() => {});
  const admin = getKafka('api-gateway').admin();
  try {
    await admin.connect();
    await admin.deleteGroups([GROUP_ID]);
    console.log(`[Gateway Realtime] Deleted consumer group ${GROUP_ID}`);
  } catch (err) {
    console.warn(`[Gateway Realtime] Could not delete consumer group ${GROUP_ID}:`, err.message);
  } finally {
    await admin.disconnect().catch(() => {});
  }
}

export async function startRealtimeConsumer() {
  const consumer = getKafka('api-gateway').consumer({
    groupId: GROUP_ID,
    allowAutoTopicCreation: false
  });
  consumer.on(consumer.events.CRASH, ({ payload }) => {
    if (payload.restart) return;
    console.error('[Gateway Realtime] Consumer crashed and will not restart, exiting:', payload.error?.message);
    process.exit(1);
  });

  await consumer.connect();
  try {
    await consumer.subscribe({ topics: [TOPICS.ORDER, TOPICS.INVENTORY], fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        let event;
        try {
          event = JSON.parse(message.value.toString());
        } catch {
          return;
        }
        if (ORDER_EVENTS.has(event.type)) {
          // orderId lets a waiting checkout recognise its own order; clients still re-fetch it
          broadcast({ type: 'orders.updated', orderId: event.aggregateId, event: event.type });
        } else if (STOCK_EVENTS.has(event.type)) {
          broadcast({ type: 'catalog.updated', source: 'inventory' });
        }
      }
    });
  } catch (err) {
    await consumer.disconnect().catch(() => {});
    throw err;
  }
  console.log('[Gateway Realtime] Forwarding order/inventory events to WebSocket clients');
  return consumer;
}
