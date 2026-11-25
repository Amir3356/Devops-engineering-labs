import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import { initCache, cacheStatus } from '../utils/cache.js';

initCache('inventory');
import inventoryRoutes from './routes/inventory.routes.js';
import { success } from '../utils/response.js';
import pool from './config/db.js';
import { startOutboxRelay, startWithRetry, onShutdown } from '../utils/events/index.js';
import { startOrderConsumer } from './events/order.consumer.js';

import { initMetrics, registerGaugeCollector } from '../utils/metrics.js';
const app = express();

// Prometheus: HTTP rate/errors/duration + Node runtime metrics at GET /metrics
initMetrics(app, 'inventory-service');

// Enable CORS using the official 'cors' package library
app.use(cors(corsOptions));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[INVENTORY SERVICE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  return success(res, {
    service: 'inventory-service',
    status: 'UP',
    cache: cacheStatus(),
    port: config.PORT,
    timestamp: new Date().toISOString()
  }, 'Inventory Service is healthy');
});

// Mount Routes under standard path
app.use('/api/inventory', inventoryRoutes);

// Central error handler
app.use((err, req, res, _next) => {
  console.error('[INVENTORY SERVICE ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Inventory Service Error',
    timestamp: new Date().toISOString()
  });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const PORT = config.PORT;
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`📊 Inventory Service running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`======================================================\n`);
  });
  const stockSummary = async () =>
    (await pool.query(
      `SELECT COALESCE(sum(stock_quantity), 0)::int AS units,
              count(*) FILTER (WHERE stock_quantity <= low_stock_threshold)::int AS low,
              count(*) FILTER (WHERE stock_quantity = 0)::int AS out
       FROM inventory_stock`
    )).rows[0];
  registerGaugeCollector({
    name: 'inventory_units_in_stock',
    help: 'Total units in stock across all products',
    read: async () => [{ value: (await stockSummary()).units }]
  });
  registerGaugeCollector({
    name: 'inventory_products',
    help: 'Products by stock level (low = at or below their low-stock threshold)',
    labelNames: ['level'],
    read: async () => {
      const s = await stockSummary();
      return [
        { labels: { level: 'low' }, value: s.low },
        { labels: { level: 'out_of_stock' }, value: s.out }
      ];
    }
  });
  // Order saga: reserve/restore stock from order.events, reply on inventory.events
  const relay = startOutboxRelay({ pool, serviceName: 'inventory-service' });
  onShutdown(() => relay.stop());
  startWithRetry('Inventory Consumer', () => startOrderConsumer(pool)).then((consumer) =>
    onShutdown(() => consumer.disconnect())
  );
}

export default app;
