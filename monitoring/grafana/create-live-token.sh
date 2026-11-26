#!/usr/bin/env bash
# Creates the Grafana service account the Node services use to push real-time (1 s) metrics
# to Grafana Live, and stores its token as GRAFANA_LIVE_TOKEN in the root .env file
# (git-ignored; docker compose reads it automatically). Safe to re-run: replaces the token.
#
#   ./monitoring/grafana/create-live-token.sh
#   docker compose up -d        # recreate the services so they pick up the token
#
# Env: GRAFANA_URL (default http://localhost:3001), GRAFANA_ADMIN_USER / GRAFANA_ADMIN_PASSWORD
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/.env"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
AUTH="${GRAFANA_ADMIN_USER:-admin}:${GRAFANA_ADMIN_PASSWORD:-admin}"
SA_NAME="live-metrics-pusher"

json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

# 1. Find or create the service account (Editor: allowed to push to /api/live/push)
SA_ID=$(curl -sf -u "$AUTH" "$GRAFANA_URL/api/serviceaccounts/search?query=$SA_NAME" \
  | json "next((a['id'] for a in d['serviceAccounts'] if a['name']=='$SA_NAME'), '')")
if [ -z "$SA_ID" ]; then
  SA_ID=$(curl -sf -u "$AUTH" -H 'Content-Type: application/json' -X POST "$GRAFANA_URL/api/serviceaccounts" \
    -d "{\"name\":\"$SA_NAME\",\"role\":\"Editor\",\"isDisabled\":false}" | json "d['id']")
  echo "Created service account $SA_NAME (id $SA_ID)"
fi

# 2. Replace its token
for TID in $(curl -sf -u "$AUTH" "$GRAFANA_URL/api/serviceaccounts/$SA_ID/tokens" | json "' '.join(str(t['id']) for t in d)"); do
  curl -sf -u "$AUTH" -X DELETE "$GRAFANA_URL/api/serviceaccounts/$SA_ID/tokens/$TID" >/dev/null
done
TOKEN=$(curl -sf -u "$AUTH" -H 'Content-Type: application/json' -X POST "$GRAFANA_URL/api/serviceaccounts/$SA_ID/tokens" \
  -d '{"name":"live-push"}' | json "d['key']")

# 3. Store it in the root .env (create the file if needed, replace an existing line)
touch "$ENV_FILE"
if grep -q '^GRAFANA_LIVE_TOKEN=' "$ENV_FILE"; then
  sed -i "s|^GRAFANA_LIVE_TOKEN=.*|GRAFANA_LIVE_TOKEN=$TOKEN|" "$ENV_FILE"
else
  printf '\n# Grafana Live push token (monitoring/grafana/create-live-token.sh)\nGRAFANA_LIVE_TOKEN=%s\n' "$TOKEN" >> "$ENV_FILE"
fi
echo "GRAFANA_LIVE_TOKEN written to $ENV_FILE — now run: docker compose up -d"
