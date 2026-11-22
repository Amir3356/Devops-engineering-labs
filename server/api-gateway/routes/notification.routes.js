import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.NOTIFICATION);

// ==========================================
// Notification Service Endpoints (Port 5007)
// ==========================================
router.use('/', authenticateToken, proxy);

export default router;
