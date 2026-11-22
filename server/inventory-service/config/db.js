import { createDbPool } from '../../utils/dbPool.js';
import config from './index.js';

const pool = createDbPool('Inventory Service', config.DB.connectionString);

export default pool;
