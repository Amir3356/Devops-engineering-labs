/**
 * Capacity test — how many concurrent users can NexusCommerce handle before performance degrades?
 *
 * Each virtual user (VU) = one concurrent user browsing the shop: catalog, categories, policies,
 * inventory, own orders, with 1–3 s of "think time" between pages. Load rises in steps and holds
 * each step, so Grafana can show the latency / error rate / throughput at every user level and
 * find the point where it degrades (dashboard "NexusCommerce — Capacity & Concurrent Users").
 *
 * Results stream to Prometheus (k6 remote-write output). Run with:  ./loadtest/run.sh
 *
 * Env (all optional):
 *   STEPS           user levels, default "10,25,50,100,150,200,300,400"
 *   STEP_DURATION   how long each level is held, default "1m"
 *   RAMP            time to move between levels, default "15s"
 *   BASE_URL        default http://api-gateway:5000
 *   SLO_P95_MS      latency limit used for pass/fail thresholds, default 500
 *   SLO_ERROR_RATE  error-rate limit (0–1), default 0.01
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE = __ENV.BASE_URL || 'http://api-gateway:5000';
const STEPS = (__ENV.STEPS || '10,25,50,100,150,200,300,400').split(',').map((n) => parseInt(n, 10));
const HOLD = __ENV.STEP_DURATION || '1m';
const RAMP = __ENV.RAMP || '15s';
const SLO_P95 = parseInt(__ENV.SLO_P95_MS || '500', 10);
const SLO_ERR = parseFloat(__ENV.SLO_ERROR_RATE || '0.01');

const stages = [];
for (const target of STEPS) stages.push({ duration: RAMP, target }, { duration: HOLD, target });
stages.push({ duration: RAMP, target: 0 });

export const options = {
  scenarios: {
    capacity: { executor: 'ramping-vus', startVUs: 0, stages, gracefulRampDown: '10s' }
  },
  // Pass/fail summary at the end of the run (the dashboard shows the same limits)
  thresholds: {
    http_req_duration: [`p(95)<${SLO_P95}`],
    http_req_failed: [`rate<${SLO_ERR}`]
  },
  // Rate limits and 404s are expected responses, not failures of the system
  summaryTrendStats: ['avg', 'p(50)', 'p(95)', 'p(99)', 'max']
};
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 404 }));

export function setup() {
  const res = http.post(`${BASE}/api/auth/login`,
    JSON.stringify({ email: __ENV.ADMIN_EMAIL, password: __ENV.ADMIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /api/auth/login' } });
  const token = res.json('data.token');
  if (!token) throw new Error(`Login failed (HTTP ${res.status}) — check ADMIN_EMAIL / ADMIN_PASSWORD in server/.env`);
  return { token };
}

export default function ({ token }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    // Lets the gateway rate-limit each virtual user separately (see rateLimiter.js); only
    // honoured while the gateway runs with the same LOAD_TEST_TOKEN (set by run.sh)
    'X-Load-Test-Token': __ENV.LOAD_TEST_TOKEN || '',
    'X-Load-Test-Client': `vu-${__VU}`
  };
  const get = (path, name) => {
    const r = http.get(`${BASE}${path}`, { headers, tags: { name } });
    check(r, { [`${name} ok`]: (x) => x.status < 400 });
    return r;
  };

  group('browse catalog', () => {
    get('/api/products', 'GET /api/products');
    sleep(Math.random() * 1 + 0.5);
    get('/api/products/categories', 'GET /api/products/categories');
    sleep(Math.random() * 1 + 0.5);
    get('/api/policies', 'GET /api/policies');
  });
  sleep(Math.random() * 2 + 1);
  group('account', () => {
    get('/api/inventory', 'GET /api/inventory');
    sleep(Math.random() * 1 + 0.5);
    get('/api/orders', 'GET /api/orders');
  });
  sleep(Math.random() * 2 + 1);
}
