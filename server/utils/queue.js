import { Queue, Worker } from 'bullmq';
import client from 'prom-client';
import { registry } from './metrics.js';

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
// Read-only handles used only for job counts, for queues this process consumes but never
// produces to. Kept apart from `queues` so getQueue() still applies its defaultJobOptions.
const watchedQueues = new Map();

function watchQueue(name) {
  if (queues.has(name) || watchedQueues.has(name)) return;
  const queue = new Queue(name, { connection: connectionOptions() });
  queue.on('error', (err) => console.error(`[Queue ${name}] Redis error:`, err.message));
  watchedQueues.set(name, queue);
}

// ---------- Metrics (Grafana → Message Broker & Queues) ----------
// Commands block (not fail) while the queue Redis is down; never let that hang a scrape.
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })
  ]).finally(() => clearTimeout(timer));
}

const JOB_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children', 'completed', 'failed', 'paused'];

new client.Gauge({
  name: 'bullmq_queue_jobs',
  help: 'Jobs in each BullMQ queue (on the queue Redis) by state',
  labelNames: ['queue', 'state'],
  registers: [registry],
  async collect() {
    const results = await Promise.allSettled(
      [...new Map([...watchedQueues, ...queues]).entries()].map(async ([name, queue]) => [name, await withTimeout(queue.getJobCounts(...JOB_STATES), 2000)])
    );
    this.reset();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const [queue, counts] = r.value;
      for (const [state, value] of Object.entries(counts)) this.set({ queue, state }, Number(value) || 0);
    }
  }
});

const jobsCompleted = new client.Counter({
  name: 'bullmq_jobs_completed_total',
  help: 'Jobs completed by a worker',
  labelNames: ['queue', 'job'],
  registers: [registry]
});

const jobsFailed = new client.Counter({
  name: 'bullmq_jobs_failed_total',
  help: 'Failed job attempts; final="true" when the job gave up (moved to the failed set), "false" when a retry is scheduled',
  labelNames: ['queue', 'job', 'final'],
  registers: [registry]
});

const jobRetries = new client.Counter({
  name: 'bullmq_job_retries_total',
  help: 'Retries scheduled after a failed attempt',
  labelNames: ['queue', 'job'],
  registers: [registry]
});

const jobDuration = new client.Histogram({
  name: 'bullmq_job_duration_seconds',
  help: 'Processing time of one job attempt',
  labelNames: ['queue', 'job', 'outcome'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [registry]
});

function observeAttempt(name, job, outcome) {
  if (job?.processedOn && job?.finishedOn) {
    jobDuration.observe({ queue: name, job: job.name, outcome }, (job.finishedOn - job.processedOn) / 1000);
  }
}

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
  watchQueue(name);
  worker.on('error', (err) => console.error(`[Worker ${name}] Redis error:`, err.message));
  worker.on('failed', (job, err) => {
    if (!job) return;
    const final = job.attemptsMade >= (job.opts.attempts || 1) || err.name === 'UnrecoverableError';
    jobsFailed.inc({ queue: name, job: job.name, final: String(final) });
    if (!final) jobRetries.inc({ queue: name, job: job.name });
    observeAttempt(name, { ...job, finishedOn: job.finishedOn || Date.now() }, 'failed');
    console.error(
      `[Worker ${name}] ${job.name} ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts || 1})${final ? ' — kept in the failed set' : ', will retry'}:`,
      err.message
    );
  });
  worker.on('completed', (job) => {
    jobsCompleted.inc({ queue: name, job: job.name });
    observeAttempt(name, job, 'completed');
    console.log(`[Worker ${name}] ${job.name} ${job.id} done`);
  });
  console.log(`[Worker ${name}] Started`);
  return worker;
}

export async function closeQueues() {
  await Promise.all([...queues.values(), ...watchedQueues.values()].map((q) => q.close().catch(() => {})));
  queues.clear();
  watchedQueues.clear();
}
