import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.POLICY);

// ==========================================
// Policy Service Endpoints (Port 5009)
// ==========================================
router.put('/:key', authenticateToken, requireAdmin, proxy);
router.delete('/:key', authenticateToken, requireAdmin, proxy);
router.use('/', optionalAuth, proxy);

export default router;
