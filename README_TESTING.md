Kasbah API — Local Smoke Testing

Prerequisites
- Firestore admin creds configured via env or `GOOGLE_APPLICATION_CREDENTIALS`.
- The `users` collection contains a doc for your target user with an `api_key` field.
- API server running locally: `npm start` (defaults to port 3001).

Quick Start
1) Export your test key and user id:
   - `export KASBAH_KEY=sk_xxx`
   - `export USER_ID=Bzuz0jKe63QU6Jso3TgWnmrEeZl2`
   - `export PORT=3001` (if not default)

2) Run the script:
   - `cd kasbah/kasbah-api`
   - `chmod +x scripts/test_user.sh`
   - `./scripts/test_user.sh`

3) Optional POST/idempotent tests:
   - Provide `ORDER_ID` and (optionally) `SHIPMENT_ID`:
     - `ORDER_ID=... ./scripts/test_user.sh`

Outputs
- JSON responses and HTTP status files are written under `kasbah/kasbah-api/tmp/test-YYYYMMDD-HHMMSS/`.

Endpoints Covered
- `GET /v1/ping`
- `GET /v1/users/:user_id`
- `GET /v1/orders?customer_id=:user_id`
- `GET /v1/customers/:user_id/orders`
- `GET /v1/orders/:order_id` (when `ORDER_ID` set)
- `GET /v1/orders/:order_id/items` (when `ORDER_ID` set)
- `POST /v1/orders/:order_id/acknowledge` (idempotent)
- `POST /v1/orders/:order_id/shipments` (idempotent)
- `POST /v1/orders/:order_id/shipments/:shipment_id/events` (idempotent; when `SHIPMENT_ID` set)
- `GET /v1/products?limit=5`

Tips
- Rate limit is enforced per key; low limits will 429 quickly.
- Use unique `Idempotency-Key` values for repeated POSTs to avoid 202 responses.
- If Firestore credentials aren’t configured, the API will return 503 for authenticated routes.

