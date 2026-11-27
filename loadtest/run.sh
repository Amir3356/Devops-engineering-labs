#!/usr/bin/env bash
# Capacity test: ramps virtual users up in steps and streams the results to Prometheus, so the
# Grafana dashboard "NexusCommerce — Capacity & Concurrent Users" shows how many concurrent users
# the system handles before latency / errors degrade.
#
#   ./loadtest/run.sh                                   # default steps 10 → 400 users (~11 min)
#   STEPS=10,50,100 STEP_DURATION=30s ./loadtest/run.sh  # quick run
#   SLO_P95_MS=300 SLO_ERROR_RATE=0.005 ./loadtest/run.sh
#
# For the duration of the run the API gateway gets a random one-time LOAD_TEST_TOKEN, so each
# virtual user is rate-limited as its own client (like real users with their own IPs) instead of
# all of them sharing this machine's limit. The gateway is restored without it afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."

export LOAD_TEST_TOKEN="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
export TEST_ID="capacity-$(date +%Y%m%d-%H%M%S)"

restore() {
  echo "Restoring api-gateway without the load-test token…"
  LOAD_TEST_TOKEN= docker compose up -d --no-deps api-gateway >/dev/null
}
trap restore EXIT

echo "Preparing api-gateway for the load test…"
docker compose up -d --no-deps api-gateway >/dev/null
for _ in $(seq 1 30); do curl -sf http://localhost:5000/health >/dev/null && break; sleep 2; done

echo "Running $TEST_ID — follow it live in Grafana: http://localhost:3001/d/nexuscommerce-capacity"
# k6 exits non-zero when the latency/error thresholds fail — that is a result, not an error
docker compose --profile loadtest run --rm \
  -e LOAD_TEST_TOKEN -e STEPS -e STEP_DURATION -e RAMP -e SLO_P95_MS -e SLO_ERROR_RATE \
  k6 run --tag "testid=$TEST_ID" -o experimental-prometheus-rw /scripts/capacity.js || true

# Verdict: per-level table in the terminal + stored in Prometheus for Grafana and alerting
sleep 15   # let the last remote-write batch land
VERDICT="$(python3 loadtest/verdict.py "$TEST_ID" --env)"
echo "$VERDICT" | grep -v '^[A-Z_]*='
env $(echo "$VERDICT" | grep '^[A-Z_]*=' | xargs) docker compose --profile loadtest run --rm --no-deps \
  -e CAPACITY -e DEGRADES_AT -e MAX_TESTED -e RPS_AT_CAPACITY -e SLO_P95 -e LEVELS \
  k6 run --quiet --tag "testid=$TEST_ID" -o experimental-prometheus-rw /scripts/report.js >/dev/null
echo "Result stored — Grafana: http://localhost:3001/d/nexuscommerce-capacity (Test run: $TEST_ID)"
