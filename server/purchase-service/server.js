import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import purchaseRoutes from './routes/purchase.routes.js';

import { initMetrics } from '../utils/metrics.js';
import { registerHealth, postgresCheck } from '../utils/health.js';
import pool from './config/db.js';
const app = express();

// Prometheus: HTTP rate/errors/duration + Node runtime metrics at GET /metrics
initMetrics(app, 'purchase-service');

app.use(cors(corsOptions));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[PURCHASE SERVICE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Deep health check: GET /health (dependencies) and GET /health/live (process only)
registerHealth(app, {
  service: 'purchase-service',
  checks: {
    postgres: postgresCheck(pool)
  },
  info: () => ({ port: config.PORT })
});

// Mount Routes
app.use('/api/purchases', purchaseRoutes);

// Central error handler
app.use((err, req, res, _next) => {
  console.error('[PURCHASE SERVICE ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Purchase Service Error',
    timestamp: new Date().toISOString()
  });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const PORT = config.PORT || 5003;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PURCHASE SERVICE] Server running on port ${PORT}`);
  });
}

export default app;
