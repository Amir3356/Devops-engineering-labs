import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default {
  PORT: process.env.PORT || process.env.GATEWAY_PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  RATE_LIMIT: {
    GLOBAL_MAX: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '150', 10),
    GLOBAL_WINDOW: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW || '60', 10),
    AUTH_MAX: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '20', 10),
    AUTH_WINDOW: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || '60', 10)
  },
  COOKIE: {
    NAME: process.env.COOKIE_NAME || 'token',
    SAME_SITE: process.env.COOKIE_SAME_SITE || 'lax'
  },
  SERVICES: {
    AUTH: process.env.AUTH_SERVICE_URL,
    USER: process.env.USER_SERVICE_URL,
    PRODUCT: process.env.PRODUCT_SERVICE_URL,
    PURCHASE: process.env.PURCHASE_SERVICE_URL,
    ORDER: process.env.ORDER_SERVICE_URL,
    SALE: process.env.SALE_SERVICE_URL,
    INVENTORY: process.env.INVENTORY_SERVICE_URL,
    NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL,
    POLICY: process.env.POLICY_SERVICE_URL
  }
};
