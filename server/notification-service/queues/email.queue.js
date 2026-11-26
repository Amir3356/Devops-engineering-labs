import { UnrecoverableError } from 'bullmq';
import { getQueue, startWorker } from '../../utils/queue.js';
import { sendOrderReceipt, sendSaleReceipt, isEmailConfigured } from '../services/email.service.js';

/**
 * "emails" queue (BullMQ on the queue Redis).
 *
 * The Kafka consumer only enqueues; this worker does the slow SMTP work, so a slow or
 * failing mail server never holds up Kafka partitions.
 *
 * - jobId = Kafka eventId → enqueueing the same event twice creates one job
 * - 6 attempts, exponential backoff from 10s (≈10s, 20s, 40s, 80s, 160s)
 * - rate limited to 20 emails/minute (Gmail SMTP is strict)
 * - permanent failures (bad mailbox, SMTP not configured) skip retries and stay in the
 *   failed set for 30 days, where they can be retried (see retryFailedEmails)
 */

export const EMAIL_QUEUE = 'emails';

const DEFAULT_JOB_OPTIONS = {
  attempts: 6,
  backoff: { type: 'exponential', delay: 10000 },
  // Keep finished jobs long enough that a redelivered event still finds its jobId (dedupe)
  removeOnComplete: { age: 7 * 24 * 3600, count: 5000 },
  removeOnFail: { age: 30 * 24 * 3600 }
};

const senders = {
  'order-receipt': sendOrderReceipt,
  'sale-receipt': sendSaleReceipt
};

const emailQueue = () => getQueue(EMAIL_QUEUE, DEFAULT_JOB_OPTIONS);

/**
 * @param {'order-receipt'|'sale-receipt'} kind
 * @param {object} data arguments for the matching send function
 * @param {string} jobId stable id (the Kafka eventId) so duplicates collapse into one job
 */
export function enqueueEmail(kind, data, jobId) {
  if (!senders[kind]) throw new Error(`Unknown email kind: ${kind}`);
  // BullMQ custom ids may not contain ':' (it is Redis' key separator)
  return emailQueue().add(kind, data, { jobId: `${kind}-${jobId}` });
}

async function processEmail(job) {
  const send = senders[job.name];
  if (!send) throw new UnrecoverableError(`Unknown email kind: ${job.name}`);
  if (!isEmailConfigured()) {
    throw new UnrecoverableError('Email is not configured (SMTP_USER / SMTP_APP_PASSWORD)');
  }
  try {
    return await send(job.data);
  } catch (err) {
    // 5xx = permanent rejection (unknown mailbox, policy); retrying won't help
    if (err.responseCode >= 500 && err.responseCode < 600) throw new UnrecoverableError(err.message);
    throw err;
  }
}

export function startEmailWorker() {
  return startWorker(EMAIL_QUEUE, processEmail, {
    concurrency: 2,
    limiter: { max: 20, duration: 60000 }
  });
}

/** Job counts per state, for the admin endpoint. */
export function emailQueueStats() {
  return emailQueue().getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
}

/** Put failed emails back in the queue (e.g. after SMTP was configured). */
export async function retryFailedEmails() {
  const failed = await emailQueue().getFailed(0, 999);
  await Promise.all(failed.map((job) => job.retry()));
  return failed.length;
}

/** The queue's Redis connection (for the health check), with the queue's default job options intact. */
export function emailQueueClient() {
  return emailQueue().client;
}
