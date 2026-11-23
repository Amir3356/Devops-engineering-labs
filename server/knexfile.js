import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Helper to build standard Knex configuration for an isolated microservice database.
 */
export const buildKnexConfig = (dbUrl, serviceDirName) => ({
  client: 'pg',
  connection: dbUrl,
  pool: {
    max: parseInt(process.env.DB_POOL_MAX, 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10),
    acquireTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT, 10)
  },
  migrations: {
    directory: path.join(__dirname, serviceDirName, 'migrations'),
    extension: 'js',
    loadExtensions: ['.js']
  },
  seeds: {
    directory: path.join(__dirname, serviceDirName, 'seeds'),
    extension: 'js',
    loadExtensions: ['.js']
  }
});

export const services = {
  auth: buildKnexConfig(process.env.AUTH_DB_URL, 'auth-service'),
  user: buildKnexConfig(process.env.USER_DB_URL, 'user-service'),
  product: buildKnexConfig(process.env.PRODUCT_DB_URL, 'product-service'),
  order: buildKnexConfig(process.env.ORDER_DB_URL, 'order-service'),
  inventory: buildKnexConfig(process.env.INVENTORY_DB_URL, 'inventory-service'),
  notification: buildKnexConfig(process.env.NOTIFICATION_DB_URL, 'notification-service')
};

export default services;
