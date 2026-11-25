import { createClient } from 'redis';

/**
 * Shared Redis cache — Cache-Aside (lazy loading) with TTL and versioned invalidation.
 *
 *   READ   const products = await cached('products:list', 60, () => repo.findAll());
 *          Redis hit → return copy. Miss → loader (PostgreSQL) → store copy with TTL → return.
 *
 *   WRITE  await repo.create(...);            // 1. commit to PostgreSQL first
 *          await invalidate('products');      // 2. then invalidate the whole group
 *
 * Versioned groups
 *   The first segment of a key is its group ('products', 'categories', 'stock', 'policies').
 *   Each group has a version counter in Redis and every cached entry includes it:
 *       product:products@17:list:[]        product:products@17:item:prod-123
 *   invalidate('products') is one atomic INCR (17 → 18), so every list, item and filtered
 *   entry of the group becomes unreachable at once, and then every key of the older
 *   versions is deleted from Redis (UNLINK) — outdated copies are removed permanently.
 *   A slow read that loaded data *before* a write committed re-checks the version before
 *   storing and drops its result if the version moved, so no outdated copy comes back.
 *
 * Reliability
 *   PostgreSQL is the single source of truth; Redis only holds temporary copies.
 *   Without REDIS_URL, or while Redis is down, every call goes straight to the loader and
 *   commands fail fast (no offline queue). A failed invalidation is bounded by the TTL.
 *
 * Env: REDIS_URL, CACHE_TTL_SECONDS (default 60), CACHE_DEBUG=true (log HIT/MISS/INVALIDATE).
 */

const DEFAULT_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '60', 10);
const DEBUG = process.env.CACHE_DEBUG === 'true';

let client = null;
let ready = false;
let namespace = 'app';
let warnedDown = false;

const stats = { hits: 0, misses: 0, errors: 0, invalidations: 0, removedKeys: 0, staleWritesSkipped: 0 };

/**
 * Connect once per service. Safe to call without Redis configured.
 * @param {string} serviceName key namespace, e.g. 'product' → 'product:products@3:list:[]'
 */
export function initCache(serviceName) {
  namespace = serviceName;
  const url = (process.env.REDIS_URL || '').trim();
  if (!url) {
    console.warn(`[Cache:${namespace}] REDIS_URL not set — caching disabled, reading from the database`);
    return;
  }
  if (client) return;

  client = createClient({
    url,
    disableOfflineQueue: true, // never let a request wait on a dead Redis
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: (retries) => Math.min(500 * (retries + 1), 5000)
    }
  });
  client.on('ready', () => {
    ready = true;
    warnedDown = false;
    console.log(`[Cache:${namespace}] Redis connected (${url.replace(/\/\/[^@]*@/, '//***@')}), TTL ${DEFAULT_TTL}s`);
  });
  client.on('end', () => {
    ready = false;
  });
  client.on('error', (err) => {
    ready = false;
    if (!warnedDown) {
      console.warn(`[Cache:${namespace}] Redis unavailable (${err.code || err.message}) — falling back to the database`);
      warnedDown = true;
    }
  });
  client.connect().catch(() => {}); // reported by the 'error' handler; reconnects continue
}

const live = () => (client && ready ? client : null);

/** 'products:list:[]' → group 'products', rest 'list:[]'.  'products:*' / 'products' → group 'products'. */
const splitKey = (key) => {
  const [group, ...rest] = String(key).split(':');
  return { group: group.replace(/\*$/, ''), rest: rest.join(':') };
};
const versionKey = (group) => `${namespace}:__version:${group}`;

/**
 * Current version of a group. A missing counter (first use, or evicted under memory
 * pressure) starts from the current time — never from 0 — so entries written under an
 * earlier counter can never become reachable again.
 */
async function groupVersion(redis, group) {
  const vk = versionKey(group);
  let version = await redis.get(vk);
  if (version === null) {
    await redis.set(vk, String(Date.now()), { NX: true });
    version = await redis.get(vk);
  }
  return version;
}

/**
 * Read-through cache (Cache-Aside). Returns the cached copy, or runs `loader`
 * (PostgreSQL), stores its JSON-serialisable result for `ttlSeconds`, and returns it.
 * A loader that throws (e.g. 404) caches nothing.
 */
export async function cached(key, ttlSeconds, loader) {
  const redis = live();
  const { group, rest } = splitKey(key);
  let entryKey = null;
  let version = null;

  if (redis) {
    try {
      version = await groupVersion(redis, group);
      entryKey = `${namespace}:${group}@${version}:${rest}`;
      const hit = await redis.get(entryKey);
      if (hit !== null) {
        stats.hits++;
        if (DEBUG) console.log(`[Cache:${namespace}] HIT  ${entryKey}`);
        return JSON.parse(hit);
      }
    } catch (err) {
      entryKey = null;
      stats.errors++;
      if (DEBUG) console.warn(`[Cache:${namespace}] read failed for ${key}:`, err.message);
    }
  }

  stats.misses++;
  if (DEBUG) console.log(`[Cache:${namespace}] MISS ${entryKey || `${namespace}:${key}`}`);
  const value = await loader();

  // Store only if no write committed while we were loading; otherwise this result may be
  // outdated, so it is returned to this caller but never cached.
  if (redis && entryKey && value !== undefined) {
    try {
      const current = await redis.get(versionKey(group));
      if (current === version) {
        await redis.set(entryKey, JSON.stringify(value), { EX: ttlSeconds || DEFAULT_TTL });
      } else {
        stats.staleWritesSkipped++;
        if (DEBUG) console.log(`[Cache:${namespace}] SKIP stale ${entryKey} (version moved to ${current})`);
      }
    } catch (err) {
      stats.errors++;
      if (DEBUG) console.warn(`[Cache:${namespace}] write failed for ${entryKey}:`, err.message);
    }
  }
  return value;
}

/** Permanently delete every cached entry of `group` that is not on `keepVersion`. */
async function removeOldVersions(redis, group, keepVersion) {
  const keep = `${namespace}:${group}@${keepVersion}:`;
  const batch = [];
  for await (const found of redis.scanIterator({ MATCH: `${namespace}:${group}@*`, COUNT: 200 })) {
    for (const key of Array.isArray(found) ? found : [found]) {
      if (!key.startsWith(keep)) batch.push(key);
    }
  }
  for (let i = 0; i < batch.length; i += 500) {
    await redis.unlink(batch.slice(i, i + 500)); // non-blocking delete
  }
  stats.removedKeys += batch.length;
  return batch.length;
}

/**
 * Invalidate whole groups after a successful PostgreSQL commit — call it only once the
 * write has resolved. One atomic INCR per group retires every list, item and filtered entry
 * immediately; the outdated keys are then deleted from Redis for good.
 * Accepts 'products', 'products:*' or any key of the group. Never throws.
 */
export async function invalidate(...keysOrGroups) {
  const redis = live();
  if (!redis) return;
  const groups = [...new Set(keysOrGroups.map((k) => splitKey(k).group).filter(Boolean))];
  for (const group of groups) {
    try {
      await groupVersion(redis, group); // make sure the counter exists before incrementing
      const next = await redis.incr(versionKey(group));
      stats.invalidations++;
      const removed = await removeOldVersions(redis, group, next);
      if (DEBUG) console.log(`[Cache:${namespace}] INVALIDATE ${group} → version ${next}, removed ${removed} outdated key(s)`);
    } catch (err) {
      stats.errors++;
      console.warn(`[Cache:${namespace}] invalidation of '${group}' failed (entries expire by TTL):`, err.message);
    }
  }
}

/** Cache status for /health endpoints. */
export function cacheStatus() {
  return { enabled: Boolean(client), connected: ready, ttlSeconds: DEFAULT_TTL, ...stats };
}

export const CACHE_TTL = DEFAULT_TTL;
