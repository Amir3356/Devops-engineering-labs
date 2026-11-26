import client from 'prom-client';
import { context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import { registry } from './metrics.js';
import { cacheStatus } from './cache.js';
import { getKafka } from './events/kafka.js';

/**
 * Deep health checks shared by every service.
 *
 *   registerHealth(app, {
 *     service: 'order-service',
 *     checks: { postgres: postgresCheck(pool), kafka: kafkaCheck('order-service') }
 *   });
 *
 * Routes
 *   GET /health        dependency checks → 200 UP | 200 DEGRADED | 503 DOWN
 *   GET /health/live   process is running (no dependency checks) — for liveness probes
 *
 * A check is { critical, run }. `run()` resolves (optionally with details) when the dependency
 * is fine and throws when it is not; every check has a timeout. A failing critical check makes
 * the service DOWN (503); a failing non-critical one makes it DEGRADED (still 200, because the
 * service keeps serving — e.g. the cache falls back to PostgreSQL, the outbox buffers events).
 *
 * Checks also run in the background every HEALTH_INTERVAL_MS, so the Prometheus metrics below
 * stay current even when nobody calls /health:
 *   service_health_status            2 = UP, 1 = DEGRADED, 0 = DOWN
 *   health_check_status{check}       1 = passing, 0 = failing
 *   health_check_duration_seconds{check}
 *   health_check_failures_total{check}
 */

const CHECK_TIMEOUT_MS = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS, 10) || 2000;
const HEALTH_INTERVAL_MS = parseInt(process.env.HEALTH_INTERVAL_MS, 10) || 15000;
const STATUS_VALUE = { UP: 2, DEGRADED: 1, DOWN: 0 };

const serviceHealth = new client.Gauge({
  name: 'service_health_status',
  help: 'Overall result of the service deep health check: 2 = UP, 1 = DEGRADED, 0 = DOWN',
  registers: [registry]
});

const checkStatus = new client.Gauge({
  name: 'health_check_status',
  help: 'Dependency health check result: 1 = passing, 0 = failing',
  labelNames: ['check', 'critical'],
  registers: [registry]
});

const checkDuration = new client.Gauge({
  name: 'health_check_duration_seconds',
  help: 'Duration of the last run of each dependency health check',
  labelNames: ['check'],
  registers: [registry]
});

const checkFailures = new client.Counter({
  name: 'health_check_failures_total',
  help: 'Failed dependency health checks',
  labelNames: ['check'],
  registers: [registry]
});

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

// Health checks run every few seconds per service; never let them create traces
// (no-op when tracing is disabled)
function runChecks(checks) {
  return context.with(suppressTracing(context.active()), () => runChecksTraced(checks));
}

async function runChecksTraced(checks) {
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, { critical = true, run }]) => {
      const started = process.hrtime.bigint();
      let result;
      try {
        const details = await withTimeout(Promise.resolve().then(run), CHECK_TIMEOUT_MS);
        result = { status: 'UP', critical, ...(details && typeof details === 'object' ? { details } : {}) };
      } catch (err) {
        result = { status: 'DOWN', critical, error: err.message };
        checkFailures.inc({ check: name });
      }
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      result.durationMs = Math.round(seconds * 1000);
      checkStatus.set({ check: name, critical: String(critical) }, result.status === 'UP' ? 1 : 0);
      checkDuration.set({ check: name }, seconds);
      return [name, result];
    })
  );
  const results = Object.fromEntries(entries);
  const failing = Object.values(results).filter((r) => r.status !== 'UP');
  const status = failing.some((r) => r.critical) ? 'DOWN' : failing.length ? 'DEGRADED' : 'UP';
  serviceHealth.set(STATUS_VALUE[status]);
  return { status, checks: results };
}

export function registerHealth(app, { service, checks = {}, info = () => ({}) }) {
  const startedAt = Date.now();

  app.get('/health/live', (req, res) => {
    res.json({ service, status: 'UP', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
  });

  app.get('/health', async (req, res) => {
    const { status, checks: results } = await runChecks(checks);
    res.status(status === 'DOWN' ? 503 : 200).json({
      success: status !== 'DOWN',
      service,
      status,
      checks: results,
      ...info(),
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString()
    });
  });

  // Keep the metrics fresh between probes; never keeps the process alive on shutdown
  const timer = setInterval(() => runChecks(checks).catch(() => {}), HEALTH_INTERVAL_MS);
  timer.unref();
  runChecks(checks).catch(() => {});
}

// ---------------------------------------------------------------- reusable checks

/** PostgreSQL through the service's own pool (also proves a connection can be checked out). */
export function postgresCheck(pool, { critical = true } = {}) {
  return {
    critical,
    run: async () => {
      await pool.query('SELECT 1');
      return { poolTotal: pool.totalCount, poolIdle: pool.idleCount, poolWaiting: pool.waitingCount };
    }
  };
}

/** Redis cache. Non-critical by default: reads fall back to PostgreSQL while it is down. */
export function redisCacheCheck({ critical = false } = {}) {
  return {
    critical,
    run: () => {
      const s = cacheStatus();
      if (!s.enabled) return { enabled: false };
      if (!s.connected) throw new Error('Redis cache disconnected');
      return { hits: s.hits, misses: s.misses };
    }
  };
}

/**
 * Kafka broker reachability through one long-lived admin connection.
 * Non-critical by default: the transactional outbox keeps events until Kafka is back.
 */
export function kafkaCheck(clientId, { critical = false } = {}) {
  let adminPromise = null;
  return {
    critical,
    run: async () => {
      if (!adminPromise) {
        const admin = getKafka(clientId).admin();
        adminPromise = admin.connect().then(() => admin);
        adminPromise.catch(() => {
          adminPromise = null;
        });
      }
      try {
        const admin = await adminPromise;
        const { brokers } = await admin.describeCluster();
        return { brokers: brokers.length };
      } catch (err) {
        adminPromise = null;
        throw err;
      }
    }
  };
}

/** Any ioredis-compatible client (e.g. a BullMQ queue's connection). */
export function redisPingCheck(getClient, { critical = false } = {}) {
  return {
    critical,
    run: async () => {
      const redis = await getClient();
      const pong = await redis.ping();
      if (pong !== 'PONG') throw new Error(`unexpected reply: ${pong}`);
    }
  };
}

/** Another HTTP service's /health (used by the gateway for its downstream services). */
export function httpCheck(url, { critical = false } = {}) {
  return {
    critical,
    run: async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`HTTP ${res.status}${body.status ? ` (${body.status})` : ''}`);
      return { status: body.status || 'UP' };
    }
  };
}
