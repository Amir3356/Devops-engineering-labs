import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import saleRoutes from './routes/sale.routes.js';
import { success } from '../utils/response.js';

const app = express();

app.use(cors(corsOptions));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[SALE SERVICE] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  return success(res, {
    service: 'sale-service',
    status: 'UP',
    port: config.PORT,
    timestamp: new Date().toISOString()
  }, 'Sale Service is healthy');
});

// Mount Routes
app.use('/api/sales', saleRoutes);

// Central error handler
app.use((err, req, res, _next) => {
  console.error('[SALE SERVICE ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Sale Service Error',
    timestamp: new Date().toISOString()
  });
});

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const PORT = config.PORT || 5005;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SALE SERVICE] Server running on port ${PORT}`);
  });
}

export default app;
