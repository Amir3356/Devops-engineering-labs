import { Kafka, Partitioners, logLevel } from 'kafkajs';

/**
 * One Kafka client + one idempotent producer per process.
 * Brokers come from KAFKA_BROKERS (comma separated). Inside docker-compose that is
 * `kafka:9092`; from the host (npm run order …) the default `localhost:29092` is used.
 */

export const TOPICS = Object.freeze({
  ORDER: 'order.events',
  SALE: 'sale.events',
  INVENTORY: 'inventory.events',
  PURCHASE: 'purchase.events',
  PRODUCT: 'product.events'
});

/** Every aggregate publishes to `<aggregate>.events`, keyed by aggregate id. */
export const topicForAggregate = (aggregateType) => `${aggregateType}.events`;

/** Messages a consumer group gave up on (after retries) go here. */
export const dlqTopic = (groupId) => `${groupId}.dlq`;

const brokers = (process.env.KAFKA_BROKERS || 'localhost:29092')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);

let kafka = null;
let producerPromise = null;

export function getKafka(clientId) {
  if (!kafka) {
    kafka = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.WARN,
      retry: { initialRetryTime: 300, retries: 8 }
    });
  }
  return kafka;
}

/**
 * Idempotent producer (acks=all, one in-flight request) so broker-side retries
 * never duplicate or reorder messages within a partition.
 */
export function getProducer(clientId) {
  if (!producerPromise) {
    const producer = getKafka(clientId).producer({
      idempotent: true,
      maxInFlightRequests: 1,
      allowAutoTopicCreation: false,
      createPartitioner: Partitioners.DefaultPartitioner
    });
    producerPromise = producer
      .connect()
      .then(() => producer)
      .catch((err) => {
        producerPromise = null; // let the next call try again
        throw err;
      });
  }
  return producerPromise;
}

export async function disconnectProducer() {
  if (!producerPromise) return;
  const pending = producerPromise;
  producerPromise = null;
  try {
    const producer = await pending;
    await producer.disconnect();
  } catch {
    // never connected — nothing to close
  }
}
