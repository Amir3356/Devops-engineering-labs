import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import notificationRoutes from './routes/notification.routes.js';
import internalRoutes from './routes/internal.routes.js';
import { verifyEmailTransport } from './services/email.service.js';
import { success } from '../utils/response.js';
import pool from './config/db.js';
import { startReceiptConsumer } from './events/receipt.consumer.js';
import { startWithRetry, onShutdown } from '../utils/events/index.js';
import { startEmailWorker, emailQueueStats } from './queues/email.queue.js';
import { closeQueues } from '../utils/queue.js';

import { initMetrics, registerGaugeCollector } from '../utils/metrics.js';
const app = express();

// Prometheus: HTTP rate/errors/duration + Node runtime metrics at GET /metrics
initMetrics(app, 'notification-service');

// Enable CORS using the official 'cors' package library
app.use(cors(corsOptions));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[NOTIFICATION SERVICE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  return success(res, {
    service: 'notification-service',
    status: 'UP',
    port: config.PORT,
    timestamp: new Date().toISOString()
  }, 'Notification Service is healthy');
});

// Mount Routes under standard path
app.use('/api/notifications', notificationRoutes);
// Service-to-service only (e.g. sale-service asks for a receipt email)
app.use('/internal', internalRoutes);
verifyEmailTransport();

// Central error handler
app.use((err, req, res, _next) => {
  console.error('[NOTIFICATION SERVICE ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Notification Service Error',
    timestamp: new Date().toISOString()
  });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const PORT = config.PORT;
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🔔 Notification Service running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`======================================================\n`);
  });
  registerGaugeCollector({
    name: 'email_queue_jobs',
    help: 'Jobs in the Redis "emails" queue by state',
    labelNames: ['state'],
    read: async () =>
      Object.entries(await emailQueueStats()).map(([state, value]) => ({ labels: { state }, value }))
  });
  // Redis queue worker: sends receipt emails (retries, backoff, rate limit, failed set)
  const emailWorker = startEmailWorker();
  onShutdown(() => emailWorker.close());
  onShutdown(() => closeQueues());
  // Kafka consumer: OrderConfirmed / SaleRecorded → email jobs (deduplicated, DLQ on give-up)
  startWithRetry('Notification Consumer', () => startReceiptConsumer(pool)).then((consumer) =>
    onShutdown(() => consumer.disconnect())
  );
}

export default app;
