import { createClient } from 'redis';
import client from 'prom-client';
import { registry } from '../../utils/metrics.js';

/**
 * Real-time delivery of in-app notifications (Redis pub/sub → API gateway → user's WebSocket).
 *
 *   notification-service ──PUBLISH notifications:user:<id>──► Redis ──► every gateway replica
 *                                                                     └► that user's open tabs only
 *
 * Pub/sub is what lets the gateway scale out: a user's socket may live on any replica, and every
 * replica receives the message. Delivery is best effort — the notification is already committed
 * in PostgreSQL, so a client that was offline simply loads it on its next fetch.
 *
 * Also caches each user's unread count (notifications:unread:<id>) so the bell does not run a
 * COUNT(*) on every page load; the key is invalidated whenever that user's notifications change.
 *
 * Env: REDIS_URL (the cache Redis). Without it, real-time push is off and counts come from SQL.
 */

const REDIS_URL = process.env.REDIS_URL || '';
const UNREAD_TTL_SECONDS = 300;

export const userChannel = (userId) => `notifications:user:${userId}`;
const unreadKey = (userId) => `notifications:unread:${userId}`;

const published = new client.Counter({
  name: 'notifications_realtime_published_total',
  help: 'In-app notification messages published to Redis for real-time delivery',
  labelNames: ['type', 'result'],
  registers: [registry]
});

let redis = null;
let ready = false;

function getRedis() {
  if (!REDIS_URL) return null;
  if (!redis) {
    redis = createClient({
      url: REDIS_URL,
      // Fail fast while Redis is down instead of queueing commands (callers fall back to SQL)
      disableOfflineQueue: true,
      socket: { reconnectStrategy: (retries) => Math.min(retries * 500, 5000) }
    });
    redis.on('ready', () => {
      ready = true;
      console.log('[Notifications] Redis connected (real-time push on)');
    });
    redis.on('end', () => (ready = false));
    redis.on('error', () => (ready = false));
    redis.connect().catch(() => {});
  }
  return redis;
}
getRedis();

/** Publish a message to one user's channel. Returns false when Redis is unavailable. */
export async function publishToUser(userId, message) {
  const r = getRedis();
  if (!r || !ready) {
    published.inc({ type: message.type, result: 'skipped' });
    return false;
  }
  try {
    await r.publish(userChannel(userId), JSON.stringify(message));
    published.inc({ type: message.type, result: 'ok' });
    return true;
  } catch (err) {
    published.inc({ type: message.type, result: 'error' });
    console.warn('[Notifications] publish failed:', err.message);
    return false;
  }
}

/** Unread count, cached in Redis (cache-aside). `compute()` runs the SQL count on a miss. */
export async function getUnreadCount(userId, compute) {
  const r = getRedis();
  if (r && ready) {
    try {
      const hit = await r.get(unreadKey(userId));
      if (hit !== null) return Number(hit);
    } catch {
      // fall through to SQL
    }
  }
  const count = await compute();
  if (r && ready) r.set(unreadKey(userId), String(count), { EX: UNREAD_TTL_SECONDS }).catch(() => {});
  return count;
}

export async function invalidateUnreadCount(userId) {
  const r = getRedis();
  if (r && ready) await r.del(unreadKey(userId)).catch(() => {});
}

export async function closePublisher() {
  if (redis) await redis.quit().catch(() => {});
}
