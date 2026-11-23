import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.PURCHASE);

// ==========================================
// Purchase Service Endpoints (Port 5003)
// ==========================================
router.post('/', authenticateToken, requireAdmin, proxy);
router.put('/:id', authenticateToken, requireAdmin, proxy);
router.delete('/:id', authenticateToken, requireAdmin, proxy);
router.use('/', optionalAuth, proxy);

export default router;
