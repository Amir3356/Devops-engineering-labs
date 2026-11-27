#!/usr/bin/env python3
"""Capacity verdict for one k6 test run, computed from Prometheus.

    python3 loadtest/verdict.py <testid> [--env]

A load step counts only while it has been HELD unchanged for the whole 30 s measurement window
(ramps between steps carry the previous level's latency). A held step is DEGRADED when p95
latency > SLO_P95_MS or errors > SLO_ERROR_RATE. Capacity = the highest held step that stayed
within both limits and is below the first degraded step.

Prints a table per user level; with --env also prints KEY=VALUE lines for loadtest/run.sh.
Env: PROMETHEUS_URL (default http://localhost:9090), SLO_P95_MS (500), SLO_ERROR_RATE (0.01).
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

PROM = os.environ.get("PROMETHEUS_URL", "http://localhost:9090").rstrip("/")
SLO_MS = float(os.environ.get("SLO_P95_MS") or 500)
SLO_ERR_PCT = 100 * float(os.environ.get("SLO_ERROR_RATE") or 0.01)


def query_range(expr, start, end, step=5):
    url = f"{PROM}/api/v1/query_range?" + urllib.parse.urlencode(
        {"query": expr, "start": start, "end": end, "step": step})
    result = json.load(urllib.request.urlopen(url, timeout=60))["data"]["result"]
    return {int(float(t)): float(v) for t, v in result[0]["values"]} if result else {}


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    testid, as_env = sys.argv[1], "--env" in sys.argv
    sel = f'testid="{testid}"'
    vus = f"max(k6_vus{{{sel}}})"

    # Time range of the run
    span = json.load(urllib.request.urlopen(f"{PROM}/api/v1/query?" + urllib.parse.urlencode(
        {"query": f"timestamp(k6_vus{{{sel}}})[1d:5s]"}), timeout=60))["data"]["result"]
    if not span:
        sys.exit(f"No data for test {testid} in Prometheus")
    times = [float(t) for t, _ in span[0]["values"]]
    start, end = int(min(times)), int(max(times)) + 60

    held = query_range(f"((min_over_time({vus}[30s:5s]) == on() max_over_time({vus}[30s:5s])) > 0)", start, end)
    p95 = query_range(f"1000 * histogram_quantile(0.95, sum(rate(k6_http_req_duration_seconds{{{sel}}}[30s])))", start, end)
    err = query_range(f'100 * (sum(rate(k6_http_reqs_total{{{sel},expected_response="false"}}[30s])) or vector(0))'
                      f" / sum(rate(k6_http_reqs_total{{{sel}}}[30s]))", start, end)
    rps = query_range(f"sum(rate(k6_http_reqs_total{{{sel}}}[30s]))", start, end)
    max_users = max(query_range(vus, start, end).values() or [0])

    levels = defaultdict(list)
    for t, users in held.items():
        if t in p95:
            levels[int(users)].append((p95[t], err.get(t, 0.0), rps.get(t, 0.0)))

    rows, degrades_at = [], None
    for users in sorted(levels):
        s = levels[users]
        worst_p95, worst_err = max(x[0] for x in s), max(x[1] for x in s)
        ok = worst_p95 <= SLO_MS and worst_err <= SLO_ERR_PCT
        if not ok and degrades_at is None:
            degrades_at = users
        rows.append((users, sum(x[0] for x in s) / len(s), worst_p95, worst_err, sum(x[2] for x in s) / len(s), ok))

    healthy = [r for r in rows if r[5] and (degrades_at is None or r[0] < degrades_at)]
    capacity = healthy[-1][0] if healthy else 0
    rps_at_capacity = healthy[-1][4] if healthy else 0

    print(f"\nCapacity verdict — {testid}  (limits: p95 ≤ {SLO_MS:.0f} ms, errors ≤ {SLO_ERR_PCT:g} %)\n")
    print(f"  {'users':>6}  {'p95 avg':>9}  {'p95 worst':>9}  {'errors':>7}  {'req/s':>7}")
    for users, avg, worst, e, r, ok in rows:
        print(f"  {users:>6}  {avg:>7.0f}ms  {worst:>7.0f}ms  {e:>6.2f}%  {r:>7.1f}   {'OK' if ok else 'DEGRADED'}")
    print()
    print(f"  ✅ Max concurrent users without degradation: {capacity}")
    print(f"  ⚠️  Performance degrades at: {degrades_at if degrades_at else f'not reached (tested up to {max_users:.0f}) — run with more users'}")
    print(f"     Throughput at capacity: {rps_at_capacity:.1f} req/s\n")

    if as_env:
        print(f"CAPACITY={capacity}\nDEGRADES_AT={degrades_at or 0}\nMAX_TESTED={max_users:.0f}\n"
              f"RPS_AT_CAPACITY={rps_at_capacity:.2f}\nSLO_P95={SLO_MS:.0f}\nSLO_ERR={SLO_ERR_PCT:g}")
        # users:p95avg:p95worst:errors:rps:ok;… — stored per level by report.js (Grafana table)
        print("LEVELS=" + ";".join(f"{u}:{a:.1f}:{w:.1f}:{e:.3f}:{r:.2f}:{int(ok)}" for u, a, w, e, r, ok in rows))


if __name__ == "__main__":
    main()
