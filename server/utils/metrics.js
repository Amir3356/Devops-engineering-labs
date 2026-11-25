import client from 'prom-client';

/**
 * Prometheus metrics shared by every service (scraped at GET /metrics).
 *
 *   initMetrics(app, 'order-service')   → default Node metrics + HTTP RED metrics + /metrics
 *   eventsConsumed / outboxPublished    → used by utils/events (Kafka consumer + outbox relay)
 *   registerGaugeCollector(...)         → gauges computed at scrape time (DB / queue counts)
 *
 * Every series carries a `service` label, so one Grafana dashboard covers all services.
 */

export const registry = new client.Registry();
let initialised = false;

// ---------- HTTP (rate, errors, duration) ----------
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration by method, route and status code',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry]
});

// ---------- Event streaming ----------
export const eventsConsumed = new client.Counter({
  name: 'events_consumed_total',
  help: 'Kafka events handled by a consumer group, by event type and outcome (handled|duplicate|retry|dlq)',
  labelNames: ['consumer', 'type', 'outcome'],
  registers: [registry]
});

export const outboxPublished = new client.Counter({
  name: 'outbox_events_published_total',
  help: 'Events moved from the transactional outbox to Kafka',
  registers: [registry]
});

export const outboxPublishFailures = new client.Counter({
  name: 'outbox_publish_failures_total',
  help: 'Failed attempts to publish an outbox batch to Kafka',
  registers: [registry]
});

/**
 * Route label without ids, so cardinality stays bounded:
 * the matched Express route (/api/orders/:id), else the first two path segments for proxied
 * prefixes (/api/orders), else "unmatched" for 404s (random paths must not create series).
 */
function routeLabel(req, res) {
  if (req.route?.path) return `${req.baseUrl || ''}${req.route.path}`;
  if (res.statusCode === 404) return 'unmatched';
  const segments = (req.originalUrl || '').split('?')[0].split('/').filter(Boolean).slice(0, 2);
  return `/${segments.join('/')}`;
}

function httpMetricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next();
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: routeLabel(req, res), status: String(res.statusCode) });
  });
  next();
}

/**
 * Register default + HTTP metrics and mount GET /metrics. Call right after `express()`,
 * before the routes, so every request is timed.
 */
export function initMetrics(app, serviceName) {
  if (!initialised) {
    registry.setDefaultLabels({ service: serviceName });
    client.collectDefaultMetrics({ register: registry });
    initialised = true;
  }
  app.use(httpMetricsMiddleware);
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } catch (err) {
      res.status(500).end(err.message);
    }
  });
}

/**
 * Gauge whose values are computed when Prometheus scrapes.
 * `read()` returns [{ labels: {...}, value }]; errors are logged and the gauge is left empty
 * for that scrape, so one slow dependency never breaks /metrics.
 */
export function registerGaugeCollector({ name, help, labelNames = [], read }) {
  return new client.Gauge({
    name,
    help,
    labelNames,
    registers: [registry],
    async collect() {
      try {
        const rows = await read();
        this.reset();
        for (const { labels = {}, value } of rows) this.set(labels, Number(value) || 0);
      } catch (err) {
        this.reset();
        console.warn(`[Metrics] ${name} unavailable:`, err.message);
      }
    }
  });
}
