import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default {
  PORT: process.env.PORT || process.env.ORDER_SERVICE_PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  // Paid orders take their units out of inventory before they are saved
  INVENTORY_SERVICE_URL: process.env.INVENTORY_SERVICE_URL || 'http://localhost:5006',
  // Paid orders trigger a receipt email to the customer's signup address
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5007',
  DB: {
    connectionString: process.env.ORDER_DB_URL
  }
};
