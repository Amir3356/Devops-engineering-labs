import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.AUTH);

// ==========================================
// Auth Service Endpoints (Port 5008)
// Strict rate limit applied to authentication actions
// ==========================================
router.use('/', authRateLimiter, proxy);

export default router;
