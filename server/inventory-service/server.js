import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import inventoryRoutes from './routes/inventory.routes.js';
import { success } from '../utils/response.js';

const app = express();

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
    port: config.PORT,
    timestamp: new Date().toISOString()
  }, 'Inventory Service is healthy');
});

// Mount Routes under standard path
app.use('/api/inventory', inventoryRoutes);

// Central error handler
app.use((err, req, res, next) => {
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
}

export default app;
