require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { initializeFirestore, RealOrdersService } = require('./services/real-firestore');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Raw body capture MUST be first for any signatures (kept for future use)
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => { req.rawBody = data; next(); });
});

// Security and logging
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'], credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Swagger setup (minimal, endpoint doc stubs can be added later)
const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Kasbah Orders API',
      version: '1.0.0',
      description: 'Partner API for accessing order data',
      contact: { name: 'Kasbah API Support', url: 'https://kasbah.health', email: 'api@kasbah.health' }
    },
    servers: [
      { url: process.env.API_BASE_URL || 'https://api.kasbah.health', description: 'Production' },
      { url: `http://localhost:${PORT}`, description: 'Local' }
    ]
  },
  apis: []
};
swaggerOptions.apis = ['src/*.js'];
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/v1/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Firestore init and services
const db = initializeFirestore();
const ordersService = new RealOrdersService();

// In-memory per-key rate limiter (hour window)
const rateState = new Map(); // key -> { windowStartMs, count, limit }
function currentHourWindow() {
  const now = Date.now();
  return now - (now % (60 * 60 * 1000));
}

// Simple API key auth using users collection
async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['kasbah-key'];
    if (!apiKey) {
      return res.status(401).json({ error: { type: 'unauthorized', message: 'Missing Kasbah-Key header' } });
    }

    if (!db) {
      return res.status(503).json({ error: { type: 'unavailable', message: 'Database unavailable' } });
    }

    const snap = await db.collection('users').where('api_key', '==', apiKey).limit(1).get();
    if (snap.empty) {
      return res.status(401).json({ error: { type: 'unauthorized', message: 'Invalid API key' } });
    }

    const doc = snap.docs[0];
    const user = doc.data() || {};
    const active = user.active !== false; // default true
    if (!active) {
      return res.status(401).json({ error: { type: 'unauthorized', message: 'API key inactive' } });
    }

    const limit = Number.isInteger(user.rate_limit_hourly) ? user.rate_limit_hourly : 50;
    const win = currentHourWindow();
    const st = rateState.get(apiKey) || { windowStartMs: win, count: 0, limit };
    if (st.windowStartMs !== win) { st.windowStartMs = win; st.count = 0; st.limit = limit; }
    if (st.count >= st.limit) {
      return res.status(429).json({ error: { type: 'rate_limited', message: 'Rate limit exceeded' } });
    }
    st.count += 1;
    rateState.set(apiKey, st);

    req.auth = { uid: doc.id, apiKey, limit: st.limit };
    // Rate limit headers
    const resetSec = Math.floor((st.windowStartMs + 60 * 60 * 1000) / 1000);
    res.set({
      'X-RateLimit-Limit': String(st.limit),
      'X-RateLimit-Remaining': String(Math.max(0, st.limit - st.count)),
      'X-RateLimit-Reset': String(resetSec)
    });
    return next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: { type: 'internal', message: 'Authentication failed' } });
  }
}

// Protected routes
const router = express.Router();
router.use(authenticateApiKey);

// List orders with filters
router.get('/orders', async (req, res) => {
  try {
    const { status, limit, cursor, customer_id, supplier_id } = req.query;
    const opts = { limit: Math.min(parseInt(limit) || 50, 200), cursor, sort: '-createdAt' };

    if (supplier_id) {
      if (!status) {
        return res.status(400).json({ error: { type: 'bad_request', message: 'supplier_id requires status filter until supplierIds indexing is added' } });
      }
      const result = await ordersService.getOrdersBySupplierId(String(supplier_id), { status }, opts);
      return res.json({ data: result.data, pagination: result.pagination });
    }

    if (customer_id) {
      const result = await ordersService.getOrdersByBuyerId(String(customer_id), { status }, opts);
      return res.json({ data: result.data, pagination: result.pagination });
    }

    return res.status(400).json({ error: { type: 'bad_request', message: 'Provide customer_id or supplier_id' } });
  } catch (err) {
    const code = err?.code === 'bad_request' ? 400 : 500;
    return res.status(code).json({ error: { type: code === 400 ? 'bad_request' : 'internal', message: err.message || 'Error fetching orders' } });
  }
});

// Get single order
router.get('/orders/:order_id', async (req, res) => {
  try {
    const order = await ordersService.getOrder(req.params.order_id);
    if (!order) return res.status(404).json({ error: { type: 'not_found', message: 'Order not found' } });
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ error: { type: 'internal', message: 'Error fetching order' } });
  }
});

// Order items (derived from full order suppliers/items)
router.get('/orders/:order_id/items', async (req, res) => {
  try {
    const order = await ordersService.getOrder(req.params.order_id);
    if (!order) return res.status(404).json({ error: { type: 'not_found', message: 'Order not found' } });
    // Flatten items if needed from suppliers[]
    const items = (order.suppliers || []).flatMap(s => s.items || []);
    return res.json({ data: items });
  } catch (err) {
    return res.status(500).json({ error: { type: 'internal', message: 'Error fetching order items' } });
  }
});

// Order events placeholder (until events collection is defined)
router.get('/orders/:order_id/events', async (req, res) => {
  return res.status(501).json({ error: { type: 'not_implemented', message: 'Order events not implemented yet' } });
});

// Customer orders
router.get('/customers/:customer_id/orders', async (req, res) => {
  try {
    const { status, limit, cursor } = req.query;
    const result = await ordersService.getOrdersByBuyerId(req.params.customer_id, { status }, { limit: Math.min(parseInt(limit) || 50, 200), cursor, sort: '-createdAt' });
    return res.json({ data: result.data, pagination: result.pagination });
  } catch (err) {
    return res.status(500).json({ error: { type: 'internal', message: 'Error fetching customer orders' } });
  }
});

// Supplier orders
router.get('/suppliers/:supplier_id/orders', async (req, res) => {
  try {
    const { status, limit, cursor } = req.query;
    const result = await ordersService.getOrdersBySupplierId(req.params.supplier_id, { status }, { limit: Math.min(parseInt(limit) || 50, 200), cursor, sort: '-createdAt' });
    return res.json({ data: result.data, pagination: result.pagination });
  } catch (err) {
    const code = err?.code === 'bad_request' ? 400 : 500;
    return res.status(code).json({ error: { type: code === 400 ? 'bad_request' : 'internal', message: err.message || 'Error fetching supplier orders' } });
  }
});

// Users
router.get('/users/:user_id', async (req, res) => {
  try {
    const user = await ordersService.getUser(req.params.user_id);
    if (!user) return res.status(404).json({ error: { type: 'not_found', message: 'User not found' } });
    return res.json(user);
  } catch (err) {
    // Enhanced error logging with context
    console.error('GET /v1/users/:user_id failed', {
      user_id: req.params.user_id,
      request_id: req.id || 'unknown',
      error: {
        message: err?.message,
        stack: err?.stack
      }
    });
    return res.status(500).json({ error: { type: 'internal', message: 'Error fetching user', request_id: req.id || 'unknown' } });
  }
});

// Products
router.get('/products', async (req, res) => {
  try {
    const { category, supplier_id, limit, cursor } = req.query;
    const result = await ordersService.getProducts({ category, supplier_id, status: 'active' }, { limit: Math.min(parseInt(limit) || 20, 20), cursor, sort: '-updatedAt' });
    return res.json({ data: result.data, pagination: result.pagination });
  } catch (err) {
    return res.status(500).json({ error: { type: 'internal', message: 'Error fetching products' } });
  }
});

app.use('/v1', router);

// Idempotency helper
async function ensureIdempotency(req, res, next) {
  try {
    const key = req.headers['idempotency-key'];
    if (!key) return next();
    if (!db) return res.status(503).json({ error: { type: 'unavailable', message: 'Database unavailable' } });
    const ref = db.collection('idempotency').doc(String(key));
    const snap = await ref.get();
    const signature = `${req.method}:${req.path}:${req.rawBody || ''}`;
    if (snap.exists) {
      const data = snap.data();
      if (data.signature === signature) {
        return res.status(202).json({ idempotent: true, message: 'Duplicate request ignored' });
      }
      // Signature mismatch for same key
      return res.status(409).json({ error: { type: 'conflict', message: 'Idempotency key already used with different request' } });
    }
    await ref.set({ signature, createdAt: new Date(), path: req.path, method: req.method });
    return next();
  } catch (e) {
    console.error('Idempotency error', e);
    return res.status(500).json({ error: { type: 'internal', message: 'Idempotency check failed' } });
  }
}

// Write endpoints (proposed push flows)
router.post('/orders/:order_id/acknowledge', ensureIdempotency, async (req, res) => {
  try {
    const result = await ordersService.acknowledgeOrder(req.params.order_id, req.body, { uid: req.auth?.uid });
    if (result.not_found) return res.status(404).json({ error: { type: 'not_found', message: 'Order not found' } });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: { type: 'internal', message: 'Acknowledge failed' } });
  }
});

router.post('/orders/:order_id/fulfill', ensureIdempotency, async (req, res) => {
  try {
    const result = await ordersService.fulfillOrder(req.params.order_id, req.body, { uid: req.auth?.uid });
    if (result.not_found) return res.status(404).json({ error: { type: 'not_found', message: 'Order not found' } });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: { type: 'internal', message: 'Fulfill failed' } });
  }
});

router.post('/orders/:order_id/shipments', ensureIdempotency, async (req, res) => {
  try {
    const result = await ordersService.createShipment(req.params.order_id, req.body, { uid: req.auth?.uid });
    if (result.not_found) return res.status(404).json({ error: { type: 'not_found', message: 'Order not found' } });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: { type: 'internal', message: 'Create shipment failed' } });
  }
});

router.post('/orders/:order_id/shipments/:shipment_id/events', ensureIdempotency, async (req, res) => {
  try {
    const result = await ordersService.addShipmentEvent(req.params.order_id, req.params.shipment_id, req.body, { uid: req.auth?.uid });
    if (result.not_found) return res.status(404).json({ error: { type: 'not_found', message: 'Shipment not found' } });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: { type: 'internal', message: 'Add shipment event failed' } });
  }
});

router.post('/suppliers/:supplier_id/inventory', ensureIdempotency, async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: { type: 'bad_request', message: 'Provide an array of items' } });
    }
    const result = await ordersService.upsertInventory(req.params.supplier_id, items, { uid: req.auth?.uid });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: { type: 'internal', message: 'Inventory update failed' } });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: { type: 'internal', message: 'An internal server error occurred', request_id: req.id || 'unknown' } });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: { type: 'not_found', message: 'The requested endpoint was not found', request_id: req.id || 'unknown' } });
});

app.listen(PORT, () => {
  console.log(`🚀 Kasbah API server running on port ${PORT}`);
  console.log(`📚 API docs: http://localhost:${PORT}/docs`);
  console.log(`🏥 Health:   http://localhost:${PORT}/v1/ping`);
});

module.exports = app;
