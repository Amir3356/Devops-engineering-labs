import { createDbPool } from '../../utils/dbPool.js';
import config from './index.js';

const pool = createDbPool('Notification Service', config.DB.connectionString);

export default pool;
