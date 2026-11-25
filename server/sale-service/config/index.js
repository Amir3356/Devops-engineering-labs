import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default {
  PORT: process.env.PORT || process.env.SALE_SERVICE_PORT || 5005,
  JWT_SECRET: process.env.JWT_SECRET,
  // A recorded sale takes its units from inventory; the receipt email goes out via Kafka (sale.events)
  INVENTORY_SERVICE_URL: process.env.INVENTORY_SERVICE_URL || 'http://localhost:5006',
  DB: {
    connectionString: process.env.SALE_DB_URL
  }
};
