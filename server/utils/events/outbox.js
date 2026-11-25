import { randomUUID } from 'crypto';
import { OUTBOX_DDL } from './schema.js';
import { getProducer, topicForAggregate } from './kafka.js';
import { outboxPublished, outboxPublishFailures, registerGaugeCollector } from '../metrics.js';

let backlogMetricsRegistered = false;

/** Backlog gauges: how many events wait in the outbox, and for how long (Kafka down → grows). */
function registerBacklogMetrics(pool) {
  if (backlogMetricsRegistered) return;
  backlogMetricsRegistered = true;
  const backlog = async () =>
    (await pool.query(
      `SELECT count(*)::int AS pending,
              COALESCE(EXTRACT(EPOCH FROM NOW() - min(created_at)), 0) AS oldest
       FROM outbox WHERE published_at IS NULL`
    )).rows[0];
  registerGaugeCollector({
    name: 'outbox_unpublished_events',
    help: 'Events committed to the outbox but not yet published to Kafka',
    read: async () => [{ value: (await backlog()).pending }]
  });
  registerGaugeCollector({
    name: 'outbox_oldest_unpublished_age_seconds',
    help: 'Age of the oldest unpublished outbox event (0 when the outbox is drained)',
    read: async () => [{ value: (await backlog()).oldest }]
  });
}

/**
 * Transactional outbox.
 *
 *   withTransaction(pool, async (client) => {
 *     await repo.create(data, client);                       // business row
 *     await appendEvent(client, { aggregateType, … });       // event row, same transaction
 *   });
 *
 * Both rows commit or neither does, so an event can never be lost or invented.
 * The relay then publishes unpublished rows to Kafka and marks them published.
 * A crash between "sent" and "marked" re-sends the batch: delivery is at-least-once,
 * and consumers drop duplicates through their inbox (see consumer.js).
 */

// One bootstrap per pool: concurrent `CREATE TABLE IF NOT EXISTS` calls race in Postgres
// (duplicate key on pg_type_typname_nsp_index), so the repository and the relay share it.
const outboxReady = new WeakMap();

export function ensureOutboxTable(pool) {
  if (!outboxReady.has(pool)) {
    const ready = pool.query(OUTBOX_DDL).catch((err) => {
      outboxReady.delete(pool); // allow a later retry
      throw err;
    });
    outboxReady.set(pool, ready);
  }
  return outboxReady.get(pool);
}

/** Run `fn(client)` inside BEGIN/COMMIT on one pooled connection. */
export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Record an event in the outbox. `client` must be the transaction's client.
 * @returns {string} the event id
 */
export async function appendEvent(client, { aggregateType, aggregateId, type, payload, version = 1 }) {
  if (!aggregateType || !aggregateId || !type) {
    throw new Error('appendEvent needs aggregateType, aggregateId and type');
  }
  const id = randomUUID();
  await client.query(
    `INSERT INTO outbox (id, aggregate_type, aggregate_id, event_type, event_version, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, aggregateType, String(aggregateId), type, version, JSON.stringify(payload ?? {})]
  );
  return id;
}

/** The envelope every consumer receives (message value). */
export function toEnvelope(row, source) {
  return {
    eventId: row.id,
    type: row.event_type,
    version: row.event_version,
    source,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    occurredAt: new Date(row.created_at).toISOString(),
    payload: row.payload
  };
}

/**
 * Background loop that drains the outbox into Kafka.
 * Run exactly one per service: per-aggregate ordering relies on a single publisher.
 */
export function startOutboxRelay({
  pool,
  serviceName,
  intervalMs = 500,
  batchSize = 100,
  maxBackoffMs = 30000,
  retentionDays = 7
}) {
  const tag = `[${serviceName} Outbox]`;
  let stopped = false;
  let timer = null;
  let backoff = intervalMs;
  let lastPrune = 0;
  let running = Promise.resolve();
  const ready = ensureOutboxTable(pool);
  registerBacklogMetrics(pool);

  async function publishBatch() {
    await ready;
    const producer = await getProducer(serviceName);
    let sendError = null;

    const count = await withTransaction(pool, async (client) => {
      // Lock the oldest unpublished rows; a second relay (if ever started) skips them
      const { rows } = await client.query(
        `SELECT * FROM outbox WHERE published_at IS NULL ORDER BY seq LIMIT $1 FOR UPDATE SKIP LOCKED`,
        [batchSize]
      );
      if (rows.length === 0) return 0;

      const byTopic = new Map();
      for (const row of rows) {
        const topic = topicForAggregate(row.aggregate_type);
        if (!byTopic.has(topic)) byTopic.set(topic, []);
        byTopic.get(topic).push({
          key: row.aggregate_id,
          value: JSON.stringify(toEnvelope(row, serviceName)),
          headers: { eventType: row.event_type, eventId: row.id }
        });
      }
      const ids = rows.map((r) => r.id);

      try {
        await producer.sendBatch({
          acks: -1,
          topicMessages: [...byTopic].map(([topic, messages]) => ({ topic, messages }))
        });
      } catch (err) {
        // Keep the rows unpublished but remember why, then commit that bookkeeping
        sendError = err;
        await client.query(
          `UPDATE outbox SET attempts = attempts + 1, last_error = $2 WHERE id = ANY($1::uuid[])`,
          [ids, String(err.message).slice(0, 1000)]
        );
        return 0;
      }

      await client.query(
        `UPDATE outbox SET published_at = NOW(), attempts = attempts + 1, last_error = NULL WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      return rows.length;
    });

    if (sendError) throw sendError;
    return count;
  }

  async function prune() {
    if (Date.now() - lastPrune < 60 * 60 * 1000) return;
    lastPrune = Date.now();
    const res = await pool.query(
      `DELETE FROM outbox WHERE published_at IS NOT NULL AND published_at < NOW() - make_interval(days => $1)`,
      [retentionDays]
    );
    if (res.rowCount) console.log(`${tag} Pruned ${res.rowCount} published event(s)`);
  }

  async function tick() {
    if (stopped) return;
    let published = 0;
    try {
      published = await publishBatch();
      if (published) {
        outboxPublished.inc(published);
        console.log(`${tag} Published ${published} event(s)`);
      }
      if (backoff !== intervalMs) console.log(`${tag} Kafka reachable again`);
      backoff = intervalMs;
      await prune();
    } catch (err) {
      outboxPublishFailures.inc();
      backoff = Math.min(backoff * 2, maxBackoffMs);
      console.error(`${tag} Publish failed, retrying in ${backoff}ms:`, err.message);
    }
    if (!stopped) {
      // A full batch means more are waiting: go again immediately
      timer = setTimeout(() => {
        running = tick();
      }, published === batchSize ? 0 : backoff);
    }
  }

  running = tick();
  console.log(`${tag} Relay started`);

  return {
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await running.catch(() => {});
    }
  };
}
