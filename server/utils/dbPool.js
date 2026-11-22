import { Pool } from 'pg';

/**
 * Standard PostgreSQL Connection Pooling Factory
 * 
 * Provides robust connection pooling for microservices with:
 * - Configurable pool sizing (max, min)
 * - Idle connection reclamation (idleTimeoutMillis)
 * - Fail-fast connection timeout (connectionTimeoutMillis)
 * - Automatic connection recycling (maxUses)
 * - Safe idle error handling without crashing the process
 * 
 * @param {string} serviceName - Name of the microservice for logging context
 * @param {string} connectionString - Target database connection URI
 * @param {object} overrides - Optional pool parameter overrides
 * @returns {Pool}
 */
export function createDbPool(serviceName, connectionString, overrides = {}) {
  const pool = new Pool({
    connectionString,
    max: parseInt(process.env.DB_POOL_MAX, 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT, 10),
    maxUses: parseInt(process.env.DB_POOL_MAX_USES, 10),
    ...overrides
  });

  // Event: Client checked out from pool
  pool.on('connect', () => {
    // Connection established successfully
  });

  // Event: Idle client encounter unexpected error (e.g. database restart / network dropped)
  pool.on('error', (err) => {
    console.error(`\x1b[31m[${serviceName} DB Pool Error]\x1b[0m Idle client error:`, err.message);
  });

  // Event: Client removed from pool
  pool.on('remove', () => {
    // Connection recycled or closed
  });

  return pool;
}

export default createDbPool;
