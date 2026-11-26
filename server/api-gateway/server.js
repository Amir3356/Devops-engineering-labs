import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsOptions } from '../utils/cors.js';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import routes from './routes/index.js';
import { attachRealtime } from './realtime.js';
import { startRealtimeConsumer, stopRealtimeConsumer } from './events.js';
import { startWithRetry, onShutdown } from '../utils/events/index.js';
import { requestLogger, rateLimiter, rateLimitStatus, notFoundHandler, errorHandler } from './middleware/index.js';

import { initMetrics } from '../utils/metrics.js';
import { registerHealth, httpCheck } from '../utils/health.js';
const app = express();

// Prometheus: HTTP rate/errors/duration + Node runtime metrics at GET /metrics
initMetrics(app, 'api-gateway');

// 1. Enable CORS using official 'cors' library
app.use(cors(corsOptions));

// 2. Parse incoming JSON payloads and cookies
app.use(express.json());
app.use(cookieParser());

// 3. Request Logging & Distributed Tracing (X-Request-ID)
app.use(requestLogger);

// 4. Rate Limiting Protection (DDoS and brute-force mitigation)
app.use(rateLimiter);

// 5. Root & Health Check Endpoint
// Deep health check: every downstream service + Redis (rate limiting / cache).
// A downstream outage makes the gateway DEGRADED, not DOWN: other routes keep working.
registerHealth(app, {
  service: 'api-gateway',
  checks: {
    // Rate limiting falls back to in-memory counters while Redis is down → non-critical
    redis: {
      critical: false,
      run: () => {
        if (!rateLimitStatus().connected) throw new Error('Redis disconnected (rate limiting is in-memory)');
      }
    },
    ...Object.fromEntries(
      Object.entries(config.SERVICES).map(([name, url]) => [name.toLowerCase(), httpCheck(`${url}/health`)])
    )
  },
  info: () => ({ rateLimiting: rateLimitStatus() })
});

// 6. Mount Central Microservice Routes
app.use(routes);

// 7. 404 Route Not Found Middleware
app.use(notFoundHandler);

// 8. Centralized Error Handling Middleware
app.use(errorHandler);

export default app;

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  const PORT = config.PORT;
  const server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 API Gateway active on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Direct Microservice Reverse Proxies:`);
    for (const [name, url] of Object.entries(config.SERVICES)) {
      console.log(`   • ${name.padEnd(14)} -> ${url}`);
    }
    console.log(`======================================================\n`);
  });
  // Real-time channel (ws://<gateway>/ws) shares the HTTP port
  attachRealtime(server);
  // Async order/stock changes (order saga) reach clients through Kafka events
  startWithRetry('Gateway Realtime', startRealtimeConsumer).then((consumer) =>
    onShutdown(() => stopRealtimeConsumer(consumer))
  );
}
