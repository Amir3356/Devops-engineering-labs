import { Pool } from 'pg';
import client from 'prom-client';
import { registry } from './metrics.js';

/**
 * Standard PostgreSQL Connection Pooling Factory
 *
 * Provides robust connection pooling for microservices with:
 * - Configurable pool sizing (max, min)
 * - Idle connection reclamation (idleTimeoutMillis)
 * - Fail-fast connection timeout (connectionTimeoutMillis)
 * - Automatic connection recycling (maxUses)
 * - Safe idle error handling without crashing the process
 * - Prometheus metrics: pool usage, query latency, slow queries, transactions
 *
 * @param {string} serviceName - Name of the microservice for logging context
 * @param {string} connectionString - Target database connection URI
 * @param {object} overrides - Optional pool parameter overrides
 * @returns {Pool}
 */

// ---------- Metrics (shared by every pool in the process) ----------
const SLOW_QUERY_MS = parseInt(process.env.DB_SLOW_QUERY_MS, 10) || 500;
const pools = new Map(); // pool label → Pool

new client.Gauge({
  name: 'db_pool_connections',
  help: 'pg pool connections by state (active = checked out, idle, waiting = callers queued for a connection, max = pool size)',
  labelNames: ['pool', 'state'],
  registers: [registry],
  collect() {
    this.reset();
    for (const [name, pool] of pools) {
      this.set({ pool: name, state: 'active' }, pool.totalCount - pool.idleCount);
      this.set({ pool: name, state: 'idle' }, pool.idleCount);
      this.set({ pool: name, state: 'waiting' }, pool.waitingCount);
      this.set({ pool: name, state: 'max' }, pool.options.max || 10);
    }
  }
});

const queryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'PostgreSQL query duration seen by the service, by SQL operation',
  labelNames: ['pool', 'operation', 'outcome'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry]
});

const slowQueries = new client.Counter({
  name: 'db_slow_queries_total',
  help: `Queries slower than DB_SLOW_QUERY_MS (${SLOW_QUERY_MS} ms)`,
  labelNames: ['pool', 'operation'],
  registers: [registry]
});

const transactionDuration = new client.Histogram({
  name: 'db_transaction_duration_seconds',
  help: 'Time from BEGIN to COMMIT/ROLLBACK on one connection',
  labelNames: ['pool', 'outcome'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry]
});

const OPERATIONS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'WITH']);

function operationOf(sql) {
  const word = /^\s*([a-z]+)/i.exec(sql)?.[1]?.toUpperCase();
  if (word === 'START') return 'BEGIN';
  if (word === 'END') return 'COMMIT';
  return OPERATIONS.has(word) ? word : 'OTHER';
}

/**
 * Time every query on a pooled client. pool.query() runs through client.query() too,
 * so wrapping the client once (when the pool creates it) covers both styles without
 * double counting. Supports the promise and callback forms; Submittables (cursors,
 * streams) are passed through untimed.
 */
function instrumentClient(pgClient, poolName) {
  if (pgClient.__metricsWrapped) return;
  pgClient.__metricsWrapped = true;
  const original = pgClient.query.bind(pgClient);

  pgClient.query = (...args) => {
    const first = args[0];
    const sql = typeof first === 'string' ? first : first?.text;
    if (typeof sql !== 'string' || typeof first?.submit === 'function') return original(...args);

    const operation = operationOf(sql);
    const started = process.hrtime.bigint();

    const record = (ok) => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      queryDuration.observe({ pool: poolName, operation, outcome: ok ? 'ok' : 'error' }, seconds);
      if (seconds * 1000 >= SLOW_QUERY_MS) {
        slowQueries.inc({ pool: poolName, operation });
        console.warn(`[${poolName} DB] slow ${operation} (${Math.round(seconds * 1000)} ms): ${sql.slice(0, 200)}`);
      }
      if (operation === 'BEGIN' && ok) {
        pgClient.__txStarted = started;
      } else if ((operation === 'COMMIT' || operation === 'ROLLBACK') && pgClient.__txStarted) {
        const txSeconds = Number(process.hrtime.bigint() - pgClient.__txStarted) / 1e9;
        transactionDuration.observe({ pool: poolName, outcome: ok ? operation.toLowerCase() : 'error' }, txSeconds);
        pgClient.__txStarted = null;
      }
    };

    const last = args[args.length - 1];
    if (typeof last === 'function') {
      args[args.length - 1] = (err, res) => {
        record(!err);
        last(err, res);
      };
      return original(...args);
    }

    const result = original(...args);
    if (result && typeof result.then === 'function') {
      result.then(() => record(true), () => record(false));
    }
    return result;
  };
}

export function createDbPool(serviceName, connectionString, overrides = {}) {
  const pool = new Pool({
    connectionString,
    max: parseInt(process.env.DB_POOL_MAX, 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT, 10),
    maxUses: parseInt(process.env.DB_POOL_MAX_USES, 10),
    ...overrides
  });

  // Unique, low-cardinality label per pool ("Order Service" → "order-service")
  let poolName = serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (let i = 2; pools.has(poolName); i += 1) poolName = `${poolName.replace(/-\d+$/, '')}-${i}`;
  pools.set(poolName, pool);

  // Event: new physical connection created → time its queries
  pool.on('connect', (pgClient) => instrumentClient(pgClient, poolName));

  // Event: Idle client encounter unexpected error (e.g. database restart / network dropped)
  pool.on('error', (err) => {
    console.error(`\x1b[31m[${serviceName} DB Pool Error]\x1b[0m Idle client error:`, err.message);
  });

  // Event: Client removed from pool
  pool.on('remove', () => {
    // Connection recycled or closed
  });

  const end = pool.end.bind(pool);
  pool.end = (...args) => {
    pools.delete(poolName);
    return end(...args);
  };

  return pool;
}

export default createDbPool;
