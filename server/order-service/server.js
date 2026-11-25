import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import orderRoutes from './routes/order.routes.js';
import { success } from '../utils/response.js';
import pool from './config/db.js';
import { startOutboxRelay, startWithRetry, onShutdown } from '../utils/events/index.js';
import { startInventoryConsumer } from './events/inventory.consumer.js';

import { initMetrics, registerGaugeCollector } from '../utils/metrics.js';
const app = express();

// Prometheus: HTTP rate/errors/duration + Node runtime metrics at GET /metrics
initMetrics(app, 'order-service');

// Enable CORS using the official 'cors' package library
app.use(cors(corsOptions));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[ORDER SERVICE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  return success(res, {
    service: 'order-service',
    status: 'UP',
    port: config.PORT,
    timestamp: new Date().toISOString()
  }, 'Order Service is healthy');
});

// Mount Routes under standard path
app.use('/api/orders', orderRoutes);

// Central error handler
app.use((err, req, res, _next) => {
  console.error('[ORDER SERVICE ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Order Service Error',
    timestamp: new Date().toISOString()
  });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const PORT = config.PORT;
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`📦 Order Service running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`======================================================\n`);
  });
  registerGaugeCollector({
    name: 'orders_by_status',
    help: 'Orders currently in each status (AwaitingStock, Paid, Rejected, Cancelled, …)',
    labelNames: ['status'],
    read: async () =>
      (await pool.query('SELECT status, count(*)::int AS n FROM orders GROUP BY status')).rows.map((r) => ({
        labels: { status: r.status },
        value: r.n
      }))
  });
  // Publish committed order events to Kafka (order.events)
  const relay = startOutboxRelay({ pool, serviceName: 'order-service' });
  onShutdown(() => relay.stop());
  // Saga replies from inventory-service (StockReserved / StockRejected)
  startWithRetry('Order Consumer', () => startInventoryConsumer(pool)).then((consumer) =>
    onShutdown(() => consumer.disconnect())
  );
}

export default app;
