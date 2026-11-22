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
  SERVICES: {
    AUTH: process.env.AUTH_SERVICE_URL,
    USER: process.env.USER_SERVICE_URL,
    PRODUCT: process.env.PRODUCT_SERVICE_URL,
    ORDER: process.env.ORDER_SERVICE_URL,
    PAYMENT: process.env.PAYMENT_SERVICE_URL,
    INVENTORY: process.env.INVENTORY_SERVICE_URL,
    NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL
  }
};
