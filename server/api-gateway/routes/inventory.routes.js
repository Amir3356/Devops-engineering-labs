import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.INVENTORY);

// ==========================================
// Inventory Service Endpoints (Port 5006)
// ==========================================
router.get('/low-stock', authenticateToken, requireAdmin, proxy);
router.put('/stock/:productId', authenticateToken, requireAdmin, proxy);
router.post('/replenish', authenticateToken, requireAdmin, proxy);
router.use('/', optionalAuth, proxy);

export default router;
