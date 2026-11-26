import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import { initCache, cacheStatus } from '../utils/cache.js';

initCache('policy');
import policyRoutes from './routes/policy.routes.js';

import { initMetrics } from '../utils/metrics.js';
import { registerHealth, postgresCheck, redisCacheCheck } from '../utils/health.js';
import pool from './config/db.js';
const app = express();

// Prometheus: HTTP rate/errors/duration + Node runtime metrics at GET /metrics
initMetrics(app, 'policy-service');

app.use(cors(corsOptions));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[POLICY SERVICE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Deep health check: GET /health (dependencies) and GET /health/live (process only)
registerHealth(app, {
  service: 'policy-service',
  checks: {
    postgres: postgresCheck(pool),
    redis: redisCacheCheck()
  },
  info: () => ({ port: config.PORT, cache: cacheStatus() })
});

// Mount Routes
app.use('/api/policies', policyRoutes);

// Central error handler
app.use((err, req, res, _next) => {
  console.error('[POLICY SERVICE ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Policy Service Error',
    timestamp: new Date().toISOString()
  });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const PORT = config.PORT || 5009;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[POLICY SERVICE] Server running on port ${PORT}`);
  });
}

export default app;
