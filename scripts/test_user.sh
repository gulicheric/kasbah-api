#!/usr/bin/env bash
set -euo pipefail

# Simple smoke test for Kasbah API focused on a specific user (customer_id)
# Usage:
#   chmod +x scripts/test_user.sh
#   KASBAH_KEY=sk_xxx USER_ID=Bzuz0jKe63QU6Jso3TgWnmrEeZl2 PORT=3001 ./scripts/test_user.sh
# Optional:
#   ORDER_ID=... SHIPMENT_ID=...  # to enable POST/idempotent tests

PORT="${PORT:-3001}"
BASE="http://localhost:${PORT}"
KEY="${KASBAH_KEY:-}"
USER_ID="${USER_ID:-}"

if [[ -z "${KEY}" || -z "${USER_ID}" ]]; then
  echo "ERROR: set KASBAH_KEY and USER_ID env vars." >&2
  exit 2
fi

TS_DIR="tmp/test-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${TS_DIR}"

curl_json() {
  local method="$1"; shift
  local url="$1"; shift
  local outfile="$1"; shift
  local idk="${IDEMPOTENCY_KEY:-}"
  echo "==> ${method} ${url}"
  curl -sS -X "${method}" \
    -H "Kasbah-Key: ${KEY}" \
    ${idk:+-H "Idempotency-Key: ${idk}"} \
    -H "Content-Type: application/json" \
    "$@" \
    "${BASE}${url}" \
    -o "${outfile}.json" \
    -w "\nHTTP %{http_code}\n" | tee "${outfile}.status"
}

echo "Running against ${BASE} as USER_ID=${USER_ID}" | tee "${TS_DIR}/meta.txt"

# 1) Health
curl_json GET "/v1/ping" "${TS_DIR}/01_ping"

# 2) Users
curl_json GET "/v1/users/${USER_ID}" "${TS_DIR}/02_user"

# 3) Orders (two paths that should be equivalent)
curl_json GET "/v1/orders?customer_id=${USER_ID}" "${TS_DIR}/03_orders_query"
curl_json GET "/v1/customers/${USER_ID}/orders" "${TS_DIR}/04_orders_customer"

# 4) If an order id is provided, test detail and items
if [[ -n "${ORDER_ID:-}" ]]; then
  curl_json GET "/v1/orders/${ORDER_ID}" "${TS_DIR}/05_order_detail"
  curl_json GET "/v1/orders/${ORDER_ID}/items" "${TS_DIR}/06_order_items"

  # Optional idempotent POST exercises (safe to re-run with same Idempotency-Key)
  export IDEMPOTENCY_KEY="ack-$(date +%s)"
  curl_json POST "/v1/orders/${ORDER_ID}/acknowledge" "${TS_DIR}/07_ack" \
    --data '{"notes":"smoke test"}'

  export IDEMPOTENCY_KEY="ship-$(date +%s)"
  curl_json POST "/v1/orders/${ORDER_ID}/shipments" "${TS_DIR}/08_create_shipment" \
    --data '{"carrier":"TEST","tracking_number":"TST123","items":[]}'

  if [[ -n "${SHIPMENT_ID:-}" ]]; then
    export IDEMPOTENCY_KEY="evt-$(date +%s)"
    curl_json POST "/v1/orders/${ORDER_ID}/shipments/${SHIPMENT_ID}/events" "${TS_DIR}/09_shipment_event" \
      --data '{"type":"shipment.in_transit","status":"in_transit"}'
  fi
fi

# 5) Products (sanity; limit enforced at 20)
curl_json GET "/v1/products?limit=5" "${TS_DIR}/10_products"

echo "\nArtifacts written to ${TS_DIR}" 

