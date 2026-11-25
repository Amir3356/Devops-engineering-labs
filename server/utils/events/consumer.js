import { INBOX_DDL } from './schema.js';
import { getKafka, getProducer, dlqTopic } from './kafka.js';
import { withTransaction } from './outbox.js';
import { eventsConsumed } from '../metrics.js';

/**
 * Idempotent Kafka consumer.
 *
 * For each event with a registered handler:
 *   BEGIN
 *     INSERT INTO inbox (event_id, consumer) ON CONFLICT DO NOTHING   ← already seen? skip
 *     handler(event, { client, afterCommit })                        ← DB writes use `client`
 *   COMMIT
 *
 * A handler error rolls back the inbox row, so the event is retried with backoff.
 * After `maxAttempts` it is copied to `<groupId>.dlq` and the partition moves on.
 * Throw `new NonRetryableError(...)` to send an event straight to the DLQ.
 * The offset is committed only after the handler finished (or the DLQ write succeeded).
 */

export class NonRetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startConsumer({
  pool,
  serviceName,
  groupId = serviceName,
  topics,
  handlers,
  maxAttempts = 5,
  // Must exceed the slowest handler; handlers are DB-only (slow work goes to a Redis queue)
  sessionTimeout = 30000
}) {
  const tag = `[${serviceName} Consumer]`;
  await pool.query(INBOX_DDL);

  const consumer = getKafka(serviceName).consumer({
    groupId,
    sessionTimeout,
    rebalanceTimeout: sessionTimeout,
    heartbeatInterval: 3000,
    allowAutoTopicCreation: false
  });

  async function handleOnce(event, handler) {
    const afterCommitFns = [];
    const outcome = await withTransaction(pool, async (client) => {
      const res = await client.query(
        `INSERT INTO inbox (event_id, consumer, event_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [event.eventId, groupId, event.type]
      );
      if (res.rowCount === 0) return 'duplicate';
      await handler(event, { client, afterCommit: (fn) => afterCommitFns.push(fn) });
      return 'handled';
    });
    // Side effects that must only follow a committed change (e.g. cache invalidation)
    for (const fn of afterCommitFns) {
      await Promise.resolve()
        .then(fn)
        .catch((err) => console.error(`${tag} afterCommit step for ${event.type} failed:`, err.message));
    }
    return outcome;
  }

  async function sendToDlq({ topic, partition, message }, reason) {
    const producer = await getProducer(serviceName);
    await producer.send({
      topic: dlqTopic(groupId),
      acks: -1,
      messages: [
        {
          key: message.key,
          value: message.value,
          headers: {
            ...message.headers,
            'dlq-reason': String(reason).slice(0, 1000),
            'dlq-source-topic': topic,
            'dlq-source-partition': String(partition),
            'dlq-source-offset': String(message.offset),
            'dlq-failed-at': new Date().toISOString()
          }
        }
      ]
    });
    console.error(`${tag} Sent ${topic}[${partition}]@${message.offset} to ${dlqTopic(groupId)}: ${reason}`);
  }

  // kafkajs restarts itself after most failures; if it gives up, exit so the
  // container restarts instead of serving HTTP while silently not consuming
  consumer.on(consumer.events.CRASH, ({ payload }) => {
    if (payload.restart) return;
    console.error(`${tag} Consumer crashed and will not restart, exiting:`, payload.error?.message);
    process.exit(1);
  });

  await consumer.connect();
  try {
    for (const topic of topics) {
      // A brand-new group starts from the earliest offset so no committed event is skipped
      await consumer.subscribe({ topic, fromBeginning: true });
    }
    await runConsumer();
  } catch (err) {
    // Don't leave a half-started member in the group when the caller retries
    await consumer.disconnect().catch(() => {});
    throw err;
  }

  console.log(`${tag} Group "${groupId}" consuming ${topics.join(', ')}`);
  return consumer;

  function runConsumer() {
    return consumer.run({
      eachMessage: async (ctx) => {
        const { message, heartbeat } = ctx;
        let event;
        try {
          event = JSON.parse(message.value.toString());
        } catch {
          await sendToDlq(ctx, 'Message is not valid JSON');
          return;
        }

        const handler = handlers[event.type];
        if (!handler) return; // not an event this service cares about
        if (!event.eventId) {
          await sendToDlq(ctx, 'Event has no eventId');
          return;
        }

        for (let attempt = 1; ; attempt++) {
          try {
            await heartbeat();
            const outcome = await handleOnce(event, handler);
            eventsConsumed.inc({ consumer: groupId, type: event.type, outcome });
            if (outcome === 'duplicate') console.log(`${tag} Skipped duplicate ${event.type} ${event.eventId}`);
            return;
          } catch (err) {
            if (err instanceof NonRetryableError || attempt >= maxAttempts) {
              await sendToDlq(ctx, `${event.type} failed after ${attempt} attempt(s): ${err.message}`);
              eventsConsumed.inc({ consumer: groupId, type: event.type, outcome: 'dlq' });
              return;
            }
            eventsConsumed.inc({ consumer: groupId, type: event.type, outcome: 'retry' });
            const delay = Math.min(1000 * 2 ** (attempt - 1), 15000);
            console.warn(`${tag} ${event.type} ${event.eventId} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, err.message);
            await sleep(delay);
          }
        }
      }
    });
  }
}
