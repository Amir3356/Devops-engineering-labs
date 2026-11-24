import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default {
  PORT: process.env.PORT || process.env.SALE_SERVICE_PORT || 5005,
  JWT_SECRET: process.env.JWT_SECRET,
  // A recorded sale takes its units from inventory and emails the customer a receipt
  INVENTORY_SERVICE_URL: process.env.INVENTORY_SERVICE_URL || 'http://localhost:5006',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5007',
  DB: {
    connectionString: process.env.SALE_DB_URL
  }
};
