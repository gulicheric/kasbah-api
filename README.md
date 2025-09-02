# Kasbah Orders API

A secure REST API for partner integration with Kasbah's order management system. Built with Node.js and Express, featuring HMAC authentication, comprehensive filtering, and production-ready architecture.

## 🚀 Features

- **HMAC Authentication**: Secure request signing with SHA-256
- **Comprehensive Filtering**: Status, dates, customer IDs, and more
- **Cursor Pagination**: Stable pagination for large datasets
- **Rate Limiting**: 600 req/min burst, 50 req/sec sustained
- **Full Error Handling**: Consistent error responses with documentation
- **Partner-Ready**: Postman collection, SDKs, and detailed docs

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /v1/ping` | Public | Health check |
| `GET /v1/orders` | Protected | List orders with filtering |
| `GET /v1/orders/{id}` | Protected | Order details |
| `GET /v1/orders/{id}/items` | Protected | Order line items |
| `GET /v1/orders/{id}/events` | Protected | Order status history |

## 🔧 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:3001
```

### Environment Variables

```env
PORT=3001
NODE_ENV=development
API_BASE_URL=https://api.kasbah.health
ALLOWED_ORIGINS=http://localhost:3000,https://kasbah.health
```

### Test Authentication

```bash
# Generate test signature
node test-auth.js

# Test authenticated endpoint
curl -H "Kasbah-Key: pk_live_abc123" \
     -H "Kasbah-Signature: t=1234567890,s=abc123..." \
     http://localhost:3001/v1/orders
```

## 🐳 Deployment

### Railway

```bash
# Deploy to Railway
railway deploy

# Set environment variables
railway variables set PORT=3001
```

### Docker

```bash
# Build image
docker build -t kasbah-api .

# Run container
docker run -p 3001:3001 -e NODE_ENV=production kasbah-api
```

## 🧪 Testing with Postman

1. Import `examples/Kasbah_API_Postman_Collection.json`
2. Import `examples/Kasbah_API_Environment.json`
3. Update environment variables with your API keys
4. Run the collection to test all endpoints

## 📋 Sample Requests

### List Orders
```bash
curl -H "Kasbah-Key: your_key" \
     -H "Kasbah-Signature: your_signature" \
     "https://api.kasbah.health/v1/orders?status=FULFILLED&limit=25"
```

### Filter by Date Range
```bash
curl -H "Kasbah-Key: your_key" \
     -H "Kasbah-Signature: your_signature" \
     "https://api.kasbah.health/v1/orders?created_at[gte]=2025-07-01T00:00:00Z"
```

## 🔐 Authentication

The API uses HMAC-SHA256 signatures:

```javascript
const crypto = require('crypto');

function generateSignature(method, path, body, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}\n${method}\n${path}\n${body}`;
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  return `t=${timestamp},s=${signature}`;
}
```

## 🏗️ Architecture

- **Express 4.x**: Web framework
- **Node.js 18+**: Runtime
- **Firestore**: Database (with mock fallback)
- **HMAC-SHA256**: Request authentication
- **JSON**: Request/response format

## 📈 Performance

- **Rate Limiting**: Built-in protection against abuse
- **Cursor Pagination**: Efficient pagination for large datasets
- **Caching**: Ready for Redis integration
- **Health Checks**: Built-in monitoring endpoints

## 🛠️ Development

```bash
# Development with auto-reload
npm run dev

# Production build
npm start

# Test endpoints
npm test
```

## 📞 Support

- **Documentation**: See `examples/README.md`
- **Postman Collection**: `examples/Kasbah_API_Postman_Collection.json`
- **Issues**: GitHub Issues or api@kasbah.health

## 📝 License

Private - Kasbah Health Technologies

---

Built with ❤️ for seamless partner integration