/**
 * Stores a capacity verdict (computed by loadtest/verdict.py) in Prometheus through the k6
 * remote-write output, tagged with the test id. Grafana ("Right now" panels) and the
 * "Approaching capacity" alert read the latest result from these series:
 *   k6_capacity_users, k6_capacity_degrades_at_users, k6_capacity_max_tested_users,
 *   k6_capacity_rps, k6_capacity_slo_p95_ms, k6_capacity_result_time
 * Called by loadtest/run.sh — not meant to be run by hand.
 */
import { Gauge } from 'k6/metrics';

const metrics = {
  capacity_users: 'CAPACITY',
  capacity_degrades_at_users: 'DEGRADES_AT',
  capacity_max_tested_users: 'MAX_TESTED',
  capacity_rps: 'RPS_AT_CAPACITY',
  capacity_slo_p95_ms: 'SLO_P95'
};
const gauges = Object.fromEntries(Object.keys(metrics).map((name) => [name, new Gauge(name)]));
const resultTime = new Gauge('capacity_result_time');

// One series per tested user level (label "users"): the "Results per user level" table
const level = {
  p95_avg: new Gauge('capacity_level_p95_avg_ms'),
  p95_worst: new Gauge('capacity_level_p95_worst_ms'),
  errors: new Gauge('capacity_level_errors_pct'),
  rps: new Gauge('capacity_level_rps'),
  ok: new Gauge('capacity_level_ok')
};

export const options = { vus: 1, iterations: 1 };

export default function () {
  for (const [name, env] of Object.entries(metrics)) gauges[name].add(Number(__ENV[env] || 0));
  resultTime.add(Date.now() / 1000);
  for (const row of (__ENV.LEVELS || '').split(';').filter(Boolean)) {
    const [users, p95Avg, p95Worst, errors, rps, ok] = row.split(':');
    const tags = { users };
    level.p95_avg.add(Number(p95Avg), tags);
    level.p95_worst.add(Number(p95Worst), tags);
    level.errors.add(Number(errors), tags);
    level.rps.add(Number(rps), tags);
    level.ok.add(Number(ok), tags);
  }
}
