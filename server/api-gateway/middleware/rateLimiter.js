import { timingSafeEqual } from 'node:crypto';
import { createClient } from 'redis';
import { error } from '../../utils/response.js';
import config from '../config/index.js';

let redisClient = null;
let isRedisReady = false;
let hasWarned = false;

/**
 * Initializes and returns the shared Redis client for the API Gateway rate limiter.
 */
function getRedisClient() {
  if (redisClient) return redisClient;

  const url = (config.REDIS_URL || process.env.REDIS_URL || '').trim();
  if (!url) {
    if (!hasWarned) {
      console.warn('[RateLimiter] REDIS_URL not set — using in-memory fallback rate limiting');
      hasWarned = true;
    }
    return null;
  }

  redisClient = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: (retries) => Math.min(500 * (retries + 1), 5000)
    }
  });

  redisClient.on('ready', () => {
    isRedisReady = true;
    hasWarned = false;
    console.log(`[RateLimiter] Redis connected (${url.replace(/\/\/[^@]*@/, '//***@')})`);
  });

  redisClient.on('end', () => {
    isRedisReady = false;
  });

  redisClient.on('error', (err) => {
    isRedisReady = false;
    if (!hasWarned) {
      console.warn(`[RateLimiter] Redis unavailable (${err.code || err.message}) — failing open with in-memory fallback`);
      hasWarned = true;
    }
  });

  redisClient.connect().catch(() => {});
  return redisClient;
}

// In-memory fallback map for offline resilience / network blips
const fallbackClients = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of fallbackClients.entries()) {
    if (now - record.startTime > 60 * 1000) {
      fallbackClients.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function memoryRateLimit(key, windowSeconds, maxRequests) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  let record = fallbackClients.get(key);

  if (!record || now - record.startTime > windowMs) {
    record = { startTime: now, count: 1 };
    fallbackClients.set(key, record);
  } else {
    record.count++;
  }

  const remaining = Math.max(0, maxRequests - record.count);
  const resetSeconds = Math.ceil((record.startTime + windowMs - now) / 1000);
  return { current: record.count, remaining, resetSeconds, isBlocked: record.count > maxRequests };
}

/**
 * Load tests (loadtest/run.sh) send every virtual user from one machine, which a per-IP limit
 * would throttle long before the system itself saturates. While LOAD_TEST_TOKEN is set (only
 * for the duration of a test run) a request carrying that token is limited per simulated user
 * (X-Load-Test-Client) instead of per IP — like real users, who each have their own IP.
 * Unset (the default) → disabled.
 */
const LOAD_TEST_TOKEN = process.env.LOAD_TEST_TOKEN || '';

function isLoadTestRequest(req) {
  const given = req.headers['x-load-test-token'];
  if (!LOAD_TEST_TOKEN || typeof given !== 'string' || !req.headers['x-load-test-client']) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(LOAD_TEST_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function clientKey(req) {
  if (isLoadTestRequest(req)) return `loadtest:${String(req.headers['x-load-test-client']).slice(0, 64)}`;
  return (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Creates a rate limiting middleware backed by Redis with local fail-open fallback.
 * @param {Object} options
 * @param {string} options.prefix Key namespace, e.g. 'global' or 'auth'
 * @param {number} options.windowSeconds Time window in seconds (default: 60)
 * @param {number} options.maxRequests Maximum allowed requests per window (default: 150)
 */
export function createRateLimiter({ prefix = 'global', windowSeconds = 60, maxRequests = 150 } = {}) {
  // Ensure Redis client initialization starts
  getRedisClient();

  return async (req, res, next) => {
    // Exclude health check from rate limiting
    if (req.path === '/health') {
      return next();
    }

    const redisKey = `ratelimit:${prefix}:${clientKey(req)}`;

    try {
      if (redisClient && isRedisReady) {
        // Atomic increment in Redis
        const current = await redisClient.incr(redisKey);
        if (current === 1) {
          await redisClient.expire(redisKey, windowSeconds);
        }
        let ttl = await redisClient.ttl(redisKey);
        if (ttl === -1) {
          await redisClient.expire(redisKey, windowSeconds);
          ttl = windowSeconds;
        }

        const resetSeconds = Math.max(1, ttl);
        const remaining = Math.max(0, maxRequests - current);

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetSeconds);

        if (current > maxRequests) {
          res.setHeader('Retry-After', resetSeconds);
          return error(
            res,
            'Too many requests: Rate limit exceeded. Please try again shortly.',
            429,
            { retryAfterSeconds: resetSeconds }
          );
        }

        return next();
      }
    } catch {
      // Redis error during execution -> fall through to in-memory fallback (fail-open)
    }

    // In-memory fallback if Redis is unavailable or disconnected
    const fallback = memoryRateLimit(redisKey, windowSeconds, maxRequests);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', fallback.remaining);
    res.setHeader('X-RateLimit-Reset', fallback.resetSeconds);

    if (fallback.isBlocked) {
      res.setHeader('Retry-After', fallback.resetSeconds);
      return error(
        res,
        'Too many requests: Rate limit exceeded. Please try again shortly.',
        429,
        { retryAfterSeconds: fallback.resetSeconds }
      );
    }

    next();
  };
}

export function rateLimitStatus() {
  return {
    enabled: true,
    backend: isRedisReady ? 'redis' : 'in-memory-fallback',
    connected: isRedisReady
  };
}

const globalLimit = config.RATE_LIMIT?.GLOBAL_MAX || 150;
const globalWindow = config.RATE_LIMIT?.GLOBAL_WINDOW || 60;
const authLimit = config.RATE_LIMIT?.AUTH_MAX || 20;
const authWindow = config.RATE_LIMIT?.AUTH_WINDOW || 60;

export const rateLimiter = createRateLimiter({ prefix: 'global', windowSeconds: globalWindow, maxRequests: globalLimit });
export const authRateLimiter = createRateLimiter({ prefix: 'auth', windowSeconds: authWindow, maxRequests: authLimit });

export default rateLimiter;
