import { context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';

/**
 * Real-time (1 s) metrics → Grafana Live.
 *
 * Prometheus keeps history and drives alerts, but it is polled (scrape every 10 s, dashboard
 * refresh every 10 s). For the "Live" dashboard every service PUSHES the last second's numbers
 * to Grafana, which forwards them to open dashboards over its WebSocket (Grafana Live) — values
 * appear about one second after the requests happened, with no polling.
 *
 *   POST {GRAFANA_LIVE_URL}/api/live/push/nexus   (InfluxDB line protocol, one line per service)
 *   → channel stream/nexus/api, one series per service (tag service=…)
 *
 * Env: GRAFANA_LIVE_URL (http://grafana:3000 in docker compose), GRAFANA_LIVE_TOKEN (service
 * account token, see monitoring/grafana/create-live-token.sh). Without a token this is a no-op.
 */

const URL_BASE = (process.env.GRAFANA_LIVE_URL || '').replace(/\/$/, '');
const TOKEN = process.env.GRAFANA_LIVE_TOKEN || '';
const INTERVAL_MS = parseInt(process.env.GRAFANA_LIVE_INTERVAL_MS, 10) || 1000;
const STREAM = 'nexus';

// Counters for the current 1-second window (reset after each push)
let window_ = newWindow();
function newWindow() {
  return { count: 0, err4xx: 0, err5xx: 0, sumMs: 0, maxMs: 0 };
}

const gauges = new Map(); // field name → () => number (instant values: in-flight, users …)

/** Called for every finished HTTP request (from the metrics middleware). */
export function recordLiveRequest(durationSeconds, statusCode) {
  const ms = durationSeconds * 1000;
  window_.count += 1;
  window_.sumMs += ms;
  if (ms > window_.maxMs) window_.maxMs = ms;
  if (statusCode >= 500) window_.err5xx += 1;
  else if (statusCode >= 400) window_.err4xx += 1;
}

/** Add an instant value to every push, e.g. registerLiveGauge('websocket_clients', () => n). */
export function registerLiveGauge(field, read) {
  gauges.set(field, read);
}

const escapeTag = (v) => String(v).replace(/[ ,=]/g, '\\$&');
const num = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);

let started = false;
export function startLivePush(serviceName) {
  if (started || !URL_BASE || !TOKEN) return;
  started = true;

  let failing = false;
  const endpoint = `${URL_BASE}/api/live/push/${STREAM}`;
  const seconds = INTERVAL_MS / 1000;

  const timer = setInterval(() => {
    const w = window_;
    window_ = newWindow();

    const fields = {
      rps: w.count / seconds,
      errors_5xx: w.err5xx / seconds,
      errors_4xx: w.err4xx / seconds,
      avg_ms: w.count ? w.sumMs / w.count : 0,
      max_ms: w.maxMs
    };
    for (const [name, read] of gauges) {
      try {
        fields[name] = Number(read()) || 0;
      } catch {
        fields[name] = 0;
      }
    }
    const line =
      `api,service=${escapeTag(serviceName)} ` +
      Object.entries(fields).map(([k, v]) => `${k}=${num(v)}`).join(',') +
      ` ${Date.now()}000000`;

    // One small request per second; never traced (it would create a trace every second)
    context.with(suppressTracing(context.active()), () =>
      fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'text/plain' },
        body: line,
        signal: AbortSignal.timeout(INTERVAL_MS * 2)
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          if (failing) console.log('[Live] Grafana Live push recovered');
          failing = false;
        })
        .catch((err) => {
          if (!failing) console.warn(`[Live] Grafana Live push failing (${err.message}); will keep retrying quietly`);
          failing = true;
        })
    );
  }, INTERVAL_MS);
  timer.unref();
  console.log(`[Live] Pushing 1 s metrics to Grafana Live as "${serviceName}"`);
}
