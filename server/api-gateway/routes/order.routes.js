import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.ORDER);

// ==========================================
// Order Service Endpoints (Port 5004)
// ==========================================
router.get('/all', authenticateToken, requireAdmin, proxy);
router.patch('/:id/status', authenticateToken, requireAdmin, proxy);
router.use('/', authenticateToken, proxy);

export default router;
