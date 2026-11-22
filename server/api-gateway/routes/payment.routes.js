import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.PAYMENT);

// ==========================================
// Payment Service Endpoints (Port 5005)
// ==========================================
router.get('/records', authenticateToken, requireAdmin, proxy);
router.get('/sales-report', authenticateToken, requireAdmin, proxy);
router.use('/', authenticateToken, proxy);

export default router;
