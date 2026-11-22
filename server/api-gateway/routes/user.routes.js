import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.USER);

// ==========================================
// User Service Endpoints (Port 5001)
// ==========================================
router.use('/profile', authenticateToken, proxy);
router.use('/customers', authenticateToken, requireAdmin, proxy);
router.use('/', proxy);

export default router;
