import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { corsOptions } from '../utils/cors.js';
import config from './config/index.js';
import userRoutes from './routes/user.routes.js';
import { success } from '../utils/response.js';

const app = express();

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

// Health check
app.get('/health', (req, res) => {
  return success(res, {
    service: 'user-service',
    status: 'UP',
    port: config.PORT,
    timestamp: new Date().toISOString()
  }, 'User Service is healthy');
});

// Mount Routes under standard microservice path
app.use('/api/users', userRoutes);

// Central error handler
app.use((err, req, res, next) => {
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
