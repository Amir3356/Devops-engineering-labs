import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import authRoutes from './routes/auth.routes.js';

import { initMetrics } from '../utils/metrics.js';
import { registerHealth, postgresCheck } from '../utils/health.js';
import pool from './config/db.js';
const app = express();

// Prometheus: HTTP rate/errors/duration + Node runtime metrics at GET /metrics
initMetrics(app, 'auth-service');

// Enable CORS using the official 'cors' package library
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[AUTH SERVICE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Deep health check: GET /health (dependencies) and GET /health/live (process only)
registerHealth(app, {
  service: 'auth-service',
  checks: {
    postgres: postgresCheck(pool)
  },
  info: () => ({ port: config.PORT })
});

// Mount Routes under standard path
app.use('/api/auth', authRoutes);

// Central error handler
app.use((err, req, res, _next) => {
  console.error('[AUTH SERVICE ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Auth Service Error',
    timestamp: new Date().toISOString()
  });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const PORT = config.PORT;
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🔐 Auth Service running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`======================================================\n`);
  });
}

export default app;
