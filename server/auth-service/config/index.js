import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default {
  PORT: process.env.PORT || process.env.AUTH_SERVICE_PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  DB: {
    connectionString: process.env.AUTH_DB_URL
  }
};
