import client from 'prom-client';
import { recordLiveRequest, registerLiveGauge, startLivePush } from './livePush.js';

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

const httpResponseSize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'HTTP response body size (Content-Length when set) — used for throughput in bytes/s',
  labelNames: ['method', 'route', 'status'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [registry]
});

// ---------- Concurrency ----------
const httpInFlight = new client.Gauge({
  name: 'http_requests_in_flight',
  help: 'HTTP requests currently being processed (concurrent requests)',
  registers: [registry]
});

const httpActiveConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Open client TCP connections that have sent at least one HTTP request (keep-alive included)',
  registers: [registry]
});

// Authenticated users seen recently (req.user.id set by the auth middleware). Bounded by the
// number of real users active inside the largest window; entries older than that are pruned.
const ACTIVE_USER_WINDOWS = { '1m': 60_000, '5m': 300_000, '15m': 900_000 };
const MAX_WINDOW_MS = Math.max(...Object.values(ACTIVE_USER_WINDOWS));
const userLastSeen = new Map();

new client.Gauge({
  name: 'active_users',
  help: 'Distinct authenticated users with at least one request inside the window',
  labelNames: ['window'],
  registers: [registry],
  collect() {
    const now = Date.now();
    const counts = Object.fromEntries(Object.keys(ACTIVE_USER_WINDOWS).map((w) => [w, 0]));
    for (const [id, seen] of userLastSeen) {
      const age = now - seen;
      if (age > MAX_WINDOW_MS) {
        userLastSeen.delete(id);
        continue;
      }
      for (const [w, ms] of Object.entries(ACTIVE_USER_WINDOWS)) if (age <= ms) counts[w] += 1;
    }
    for (const [w, n] of Object.entries(counts)) this.set({ window: w }, n);
  }
});

const trackedSockets = new WeakSet();

// Plain counters mirrored for the 1-second Grafana Live push (prom-client gauge reads are async)
let inFlightNow = 0;
let connectionsNow = 0;
registerLiveGauge('in_flight', () => inFlightNow);
registerLiveGauge('connections', () => connectionsNow);
registerLiveGauge('active_users_1m', () => {
  const cutoff = Date.now() - ACTIVE_USER_WINDOWS['1m'];
  let n = 0;
  for (const seen of userLastSeen.values()) if (seen >= cutoff) n += 1;
  return n;
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
  // Handled inside a mounted router/proxy prefix (e.g. gateway router.use('/api/orders', …)):
  // a downstream 404 ("order not found") is a real API response, not a random path
  if (req.baseUrl) return req.baseUrl;
  if (res.statusCode === 404) return 'unmatched';
  const segments = (req.originalUrl || '').split('?')[0].split('/').filter(Boolean).slice(0, 2);
  return `/${segments.join('/')}`;
}

function httpMetricsMiddleware(req, res, next) {
  // Monitoring traffic is not API traffic: Prometheus scrapes and health probes (every 15 s per
  // service) would otherwise dominate throughput and drag latency averages down.
  // Health-check latency is tracked by the blackbox exporter (probe_duration_seconds).
  if (req.path === '/metrics' || req.path === '/health' || req.path.startsWith('/health/')) return next();

  const socket = req.socket;
  if (socket && !trackedSockets.has(socket)) {
    trackedSockets.add(socket);
    httpActiveConnections.inc();
    connectionsNow += 1;
    socket.once('close', () => {
      httpActiveConnections.dec();
      connectionsNow -= 1;
    });
  }

  httpInFlight.inc();
  inFlightNow += 1;
  let done = false;
  const release = () => {
    if (done) return;
    done = true;
    httpInFlight.dec();
    inFlightNow -= 1;
  };

  const end = httpDuration.startTimer();
  res.on('finish', () => {
    release();
    const labels = { method: req.method, route: routeLabel(req, res), status: String(res.statusCode) };
    recordLiveRequest(end(labels), res.statusCode);
    const size = Number(res.getHeader('content-length'));
    if (Number.isFinite(size)) httpResponseSize.observe(labels, size);
    if (req.user?.id != null) userLastSeen.set(String(req.user.id), Date.now());
  });
  // Client aborted before the response finished: still leave the in-flight count
  res.on('close', release);
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
    // Real-time 1 s push to Grafana Live (no-op unless GRAFANA_LIVE_URL + GRAFANA_LIVE_TOKEN are set)
    startLivePush(serviceName);
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
