import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import { initCache, cacheStatus } from '../utils/cache.js';

initCache('product');
import productRoutes from './routes/product.routes.js';

import { initMetrics } from '../utils/metrics.js';
import { registerHealth, postgresCheck, redisCacheCheck, httpCheck } from '../utils/health.js';
import pool from './config/db.js';
const app = express();

// Prometheus: HTTP rate/errors/duration + Node runtime metrics at GET /metrics
initMetrics(app, 'product-category-service');

// Enable CORS using the official 'cors' package library
app.use(cors(corsOptions));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[PRODUCT & CATEGORY SERVICE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Deep health check: GET /health (dependencies) and GET /health/live (process only)
registerHealth(app, {
  service: 'product-category-service',
  checks: {
    postgres: postgresCheck(pool),
    redis: redisCacheCheck(),
    minio: httpCheck(`http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}/minio/health/live`)
  },
  info: () => ({ port: config.PORT, cache: cacheStatus() })
});

// Mount Routes under standard microservice path
app.use('/api/products', productRoutes);

// Central error handler
app.use((err, req, res, _next) => {
  console.error('[PRODUCT & CATEGORY SERVICE ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Product & Category Service Error',
    timestamp: new Date().toISOString()
  });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const PORT = config.PORT;
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`📦 Product Service running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`======================================================\n`);
  });
}

export default app;
