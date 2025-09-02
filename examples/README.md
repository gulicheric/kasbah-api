# Kasbah Orders API - Partner Integration Guide

Welcome to the Kasbah Orders API! This guide will help you integrate with our API to access order data, tracking information, and webhooks.

## 🚀 Quick Start

### 1. Import Postman Collection

1. **Download the Collection**: Download `Kasbah_API_Postman_Collection.json` from this folder
2. **Import to Postman**: Open Postman → File → Import → Select the collection file
3. **Import Environment**: Also import `Kasbah_API_Environment.json` for environment variables
4. **Set Your Credentials**: Update the environment variables with your actual API keys

### 2. Authentication Setup

The API uses HMAC-SHA256 signatures for security. The Postman collection includes a pre-request script that automatically generates signatures.

**Required Headers:**
```
Kasbah-Key: pk_live_your_key_here
Kasbah-Signature: t=timestamp,s=signature_hash
```

**Environment Variables to Set:**
- `baseUrl`: API endpoint (e.g., `https://api.kasbah.health`)
- `apiKey`: Your public API key (e.g., `pk_live_abc123`)
- `KASBAH_API_SECRET`: Your secret key (e.g., `sk_live_secret123`)

### 3. Test Your Setup

1. **Health Check**: Run the "Health Check" request first (no auth required)
2. **List Orders**: Run "List Orders" to test authentication
3. **Explore**: Try other endpoints to see the full API capabilities

## 📋 Available Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/v1/ping` | GET | Health check | ❌ |
| `/v1/orders` | GET | List orders with filtering | ✅ |
| `/v1/orders/{id}` | GET | Get order details | ✅ |
| `/v1/orders/{id}/items` | GET | Get order line items | ✅ |
| `/v1/orders/{id}/events` | GET | Get order status history | ✅ |

## 🔍 Filtering & Pagination

### Query Parameters

**Filtering:**
- `status`: Filter by order status (`PENDING`, `APPROVED`, `FULFILLED`, `CANCELLED`)
- `customer_id`: Filter by customer ID
- `supplier_id`: Filter by supplier ID
- `created_at[gte]`: Orders created after date (ISO-8601)
- `created_at[lte]`: Orders created before date (ISO-8601)
- `updated_at[gte]`: Orders updated after date (ISO-8601)
- `updated_at[lte]`: Orders updated before date (ISO-8601)

**Pagination:**
- `limit`: Number of results (1-200, default: 50)
- `cursor`: Pagination cursor from previous response
- `sort`: Sort field (`created_at`, `-created_at`, `updated_at`, `-updated_at`)

### Example Requests

**Filter by status:**
```
GET /v1/orders?status=FULFILLED&limit=25
```

**Filter by date range:**
```
GET /v1/orders?created_at[gte]=2025-07-01T00:00:00Z&created_at[lte]=2025-07-31T23:59:59Z
```

**Paginate through results:**
```
GET /v1/orders?limit=50&cursor=eyJjcmVhdGVkX2F0IjoiMjAyNS0wNy0yOVQxNDozMjoxMFoiLCJpZCI6Im9yZF85YUszZlEifQ==
```

## 📊 Sample Response

```json
{
  "data": [
    {
      "id": "ord_9aK3fQ",
      "number": "KSB-102348",
      "created_at": "2025-07-29T14:32:10Z",
      "updated_at": "2025-07-29T14:45:01Z",
      "status": "FULFILLED",
      "customer": {
        "id": "cust_7x2",
        "name": "Elmwood Family Clinic"
      },
      "totals": {
        "subtotal": 412.50,
        "shipping": 18.00,
        "tax": 34.33,
        "discount": 0,
        "grand_total": 464.83,
        "currency": "USD"
      },
      "items": [
        {
          "item_id": "it_1",
          "sku": "SC1616",
          "name": "Intermittent Straight Catheter",
          "quantity": 200,
          "uom": "each",
          "unit_price": 0.43,
          "extended_price": 86.00
        }
      ],
      "shipping": {
        "method": "UPS_GROUND",
        "address": {
          "line1": "201 Main St",
          "city": "Springfield",
          "state": "IL",
          "postal_code": "62701",
          "country": "US"
        },
        "tracking": [
          {
            "shipment_id": "shp_5m2",
            "carrier": "UPS",
            "tracking_number": "1Z999AA1234567890",
            "status": "DELIVERED",
            "delivered_at": "2025-07-31T19:12:45Z"
          }
        ]
      },
      "metadata": {
        "source": "kasbah",
        "supplier_id": "sup_abc"
      }
    }
  ],
  "pagination": {
    "limit": 50,
    "has_more": false,
    "next_cursor": null
  }
}
```

## 🔐 HMAC Authentication Details

The API uses HMAC-SHA256 for request signing to ensure security and authenticity.

### Signature Generation

1. **Create the payload:**
   ```
   timestamp + "\\n" + method + "\\n" + path + "\\n" + body
   ```

2. **Generate HMAC signature:**
   ```javascript
   const signature = crypto
     .createHmac('sha256', secret)
     .update(payload, 'utf8')
     .digest('hex');
   ```

3. **Format the header:**
   ```
   Kasbah-Signature: t=1234567890,s=abc123def456...
   ```

### Example Code (Node.js)

```javascript
const crypto = require('crypto');

function generateSignature(method, path, body, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}\\n${method}\\n${path}\\n${body}`;
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  return `t=${timestamp},s=${signature}`;
}

// Usage
const signature = generateSignature('GET', '/v1/orders', '', 'your_secret_key');
```

## ⚡ Rate Limiting

- **Rate Limit**: 600 requests per minute (burst), 50 requests per second (sustained)
- **Headers**: Check `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Exceeded**: Returns `429 Too Many Requests` with `Retry-After` header

## 🚨 Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "type": "not_found",
    "message": "Order not found",
    "doc_url": "https://developer.kasbah.health/docs/errors#not_found",
    "request_id": "req_abc123"
  }
}
```

**Error Types:**
- `unauthorized`: Invalid or missing authentication
- `forbidden`: Insufficient permissions
- `not_found`: Resource not found
- `invalid_request`: Validation errors
- `rate_limited`: Rate limit exceeded
- `internal`: Server error

## 🛠️ Testing

1. **Health Check**: Verify API connectivity (no auth needed)
2. **Authentication**: Test with valid and invalid credentials
3. **Data Retrieval**: Fetch orders, items, and events
4. **Filtering**: Test various query parameters
5. **Error Cases**: Verify error handling

## 📞 Support

For API support or questions:
- **Email**: api@kasbah.health  
- **Documentation**: https://developer.kasbah.health
- **Status Page**: https://status.kasbah.health

## 🔄 Changelog

### Version 1.0.0
- Initial release with order endpoints
- HMAC authentication
- Filtering and pagination
- Comprehensive error handling

---

Happy integrating! 🎉