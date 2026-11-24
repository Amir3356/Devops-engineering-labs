import { createDbPool } from '../../utils/dbPool.js';
import config from './index.js';

const pool = createDbPool('Policy Service', config.DB.connectionString);

export default pool;
