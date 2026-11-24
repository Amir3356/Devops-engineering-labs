import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default {
  PORT: process.env.PORT || process.env.PRODUCT_SERVICE_PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  // Used to check whether a product has been purchased before it may be edited or deleted
  PURCHASE_SERVICE_URL: process.env.PURCHASE_SERVICE_URL || 'http://localhost:5003',
  DB: {
    connectionString: process.env.PRODUCT_DB_URL
  }
};
