import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import { initCache, cacheStatus } from '../utils/cache.js';

initCache('user');
import userRoutes from './routes/user.routes.js';

import { initMetrics } from '../utils/metrics.js';
import { registerHealth, postgresCheck, redisCacheCheck } from '../utils/health.js';
import pool from './config/db.js';
const app = express();

// Prometheus: HTTP rate/errors/duration + Node runtime metrics at GET /metrics
initMetrics(app, 'user-service');

// Enable CORS using the official 'cors' package library
app.use(cors(corsOptions));
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[USER SERVICE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Deep health check: GET /health (dependencies) and GET /health/live (process only)
registerHealth(app, {
  service: 'user-service',
  checks: {
    postgres: postgresCheck(pool),
    redis: redisCacheCheck()
  },
  info: () => ({ port: config.PORT, cache: cacheStatus() })
});

// Mount Routes under standard microservice path
app.use('/api/users', userRoutes);

// Central error handler
app.use((err, req, res, _next) => {
  console.error('[USER SERVICE ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal User Service Error',
    timestamp: new Date().toISOString()
  });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const PORT = config.PORT;
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`👤 User Service running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`======================================================\n`);
  });
}

export default app;
