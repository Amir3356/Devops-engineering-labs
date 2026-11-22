import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.AUTH);

// ==========================================
// Auth Service Endpoints (Port 5008)
// ==========================================
router.use('/', proxy);

export default router;
