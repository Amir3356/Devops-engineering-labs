import { Queue, Worker } from 'bullmq';

/**
 * Background job queues (BullMQ on Redis).
 *
 * Role split in this system:
 *   Kafka  → events BETWEEN services (OrderConfirmed, StockReserved, …)
 *   Redis  → jobs INSIDE a service (send this email, retry later, rate-limit SMTP …)
 *
 * Queues use their own Redis (QUEUE_REDIS_URL), not the cache Redis: the cache runs with
 * allkeys-lru and no persistence, which would silently evict or lose queued jobs.
 * The queue Redis runs with noeviction + AOF (see docker-compose `redis-queue`).
 */

const QUEUE_REDIS_URL = process.env.QUEUE_REDIS_URL || 'redis://localhost:6380';

function connectionOptions() {
  const url = new URL(QUEUE_REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
    // Required by BullMQ workers: block on Redis instead of failing commands while reconnecting
    maxRetriesPerRequest: null
  };
}

const queues = new Map();

/** One Queue (producer side) per name per process. */
export function getQueue(name, defaultJobOptions = {}) {
  if (!queues.has(name)) {
    const queue = new Queue(name, { connection: connectionOptions(), defaultJobOptions });
    queue.on('error', (err) => console.error(`[Queue ${name}] Redis error:`, err.message));
    queues.set(name, queue);
  }
  return queues.get(name);
}

/** Start a worker (consumer side). Logs failures; BullMQ handles retries/backoff. */
export function startWorker(name, processor, options = {}) {
  const worker = new Worker(name, processor, { connection: connectionOptions(), ...options });
  worker.on('error', (err) => console.error(`[Worker ${name}] Redis error:`, err.message));
  worker.on('failed', (job, err) => {
    if (!job) return;
    const final = job.attemptsMade >= (job.opts.attempts || 1) || err.name === 'UnrecoverableError';
    console.error(
      `[Worker ${name}] ${job.name} ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts || 1})${final ? ' — kept in the failed set' : ', will retry'}:`,
      err.message
    );
  });
  worker.on('completed', (job) => console.log(`[Worker ${name}] ${job.name} ${job.id} done`));
  console.log(`[Worker ${name}] Started`);
  return worker;
}

export async function closeQueues() {
  await Promise.all([...queues.values()].map((q) => q.close().catch(() => {})));
  queues.clear();
}
