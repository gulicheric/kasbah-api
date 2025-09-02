require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { RealOrdersService } = require('./services/real-firestore');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize real Firestore service
const ordersService = new RealOrdersService();

// Body parsing with raw body capture for HMAC
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
});

app.use(express.json({ limit: '10mb' }));

// Mock API key database
const mockApiKeys = {
  'pk_live_abc123': {
    partnerId: 'partner_1',
    partnerName: 'Acme Medical Supply',
    secret: 'sk_live_secret123',
    scopes: ['orders:read', 'shipments:read'],
    ipAllowlist: [], // empty = allow all IPs
    active: true
  },
  'pk_test_xyz789': {
    partnerId: 'partner_test',
    partnerName: 'Test Partner',
    secret: 'sk_test_secret789',
    scopes: ['orders:read'],
    ipAllowlist: ['127.0.0.1', '::1'],
    active: true
  }
};

// HMAC Authentication Middleware
const authenticateRequest = async (req, res, next) => {
  try {
    const apiKey = req.headers['kasbah-key'];
    const signature = req.headers['kasbah-signature'];
    
    if (!apiKey) {
      return res.status(401).json({
        error: {
          type: 'unauthorized',
          message: 'Missing Kasbah-Key header',
          doc_url: 'https://developer.kasbah.health/docs/errors#unauthorized',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    if (!signature) {
      return res.status(401).json({
        error: {
          type: 'unauthorized',
          message: 'Missing Kasbah-Signature header',
          doc_url: 'https://developer.kasbah.health/docs/errors#unauthorized',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    // Parse signature: t=timestamp,s=signature
    const sigParts = signature.split(',');
    const timestampPart = sigParts.find(part => part.startsWith('t='));
    const signaturePart = sigParts.find(part => part.startsWith('s='));
    
    if (!timestampPart || !signaturePart) {
      return res.status(401).json({
        error: {
          type: 'unauthorized',
          message: 'Invalid signature format. Expected: t=<timestamp>,s=<signature>',
          doc_url: 'https://developer.kasbah.health/docs/errors#unauthorized',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    const timestamp = timestampPart.substring(2);
    const providedSignature = signaturePart.substring(2);
    
    // Validate timestamp (prevent replay attacks)
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const clockSkew = Math.abs(currentTime - requestTime);
    
    if (clockSkew > 300) { // 5 minutes
      return res.status(401).json({
        error: {
          type: 'unauthorized',
          message: 'Request timestamp is too old or too far in the future',
          doc_url: 'https://developer.kasbah.health/docs/errors#unauthorized',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    // Look up API key
    const apiKeyData = mockApiKeys[apiKey];
    if (!apiKeyData || !apiKeyData.active) {
      return res.status(401).json({
        error: {
          type: 'unauthorized',
          message: 'Invalid API key',
          doc_url: 'https://developer.kasbah.health/docs/errors#unauthorized',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    // Verify HMAC signature
    const rawBody = req.rawBody || '';
    const signaturePayload = `${timestamp}\n${req.method}\n${req.path}\n${rawBody}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', apiKeyData.secret)
      .update(signaturePayload, 'utf8')
      .digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(providedSignature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
      return res.status(401).json({
        error: {
          type: 'unauthorized',
          message: 'Invalid signature',
          doc_url: 'https://developer.kasbah.health/docs/errors#unauthorized',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    // Attach partner info to request
    req.partner = {
      id: apiKeyData.partnerId,
      name: apiKeyData.partnerName,
      scopes: apiKeyData.scopes,
      ipAllowlist: apiKeyData.ipAllowlist
    };
    
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      error: {
        type: 'unauthorized',
        message: 'Authentication failed',
        doc_url: 'https://developer.kasbah.health/docs/errors#unauthorized',
        request_id: req.id || 'unknown'
      }
    });
  }
};

// Rate limiting headers (simple version)
const addRateLimitHeaders = (req, res, next) => {
  res.set({
    'X-RateLimit-Limit': '600',
    'X-RateLimit-Remaining': '599',
    'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 60
  });
  next();
};

// Public endpoint (no auth required)
app.get('/v1/ping', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Protected endpoints
app.get('/v1/orders', authenticateRequest, addRateLimitHeaders, async (req, res) => {
  const { status, limit, customer_id, supplier_id } = req.query;
  
  try {
    // If supplier_id is provided, get orders by supplier
    if (supplier_id) {
      const result = await ordersService.getOrdersBySupplierId(supplier_id, { status }, { limit: parseInt(limit) || 50 });
      return res.json({
        data: result.orders,
        pagination: {
          limit: result.limit,
          has_more: result.hasMore,
          next_cursor: result.nextCursor
        }
      });
    }
    
    // If customer_id is provided, get orders by buyer
    if (customer_id) {
      const result = await ordersService.getOrdersByBuyerId(customer_id, { status }, { limit: parseInt(limit) || 50 });
      return res.json({
        data: result.orders,
        pagination: {
          limit: result.limit,
          has_more: result.hasMore,
          next_cursor: result.nextCursor
        }
      });
    }
    
    // Fallback to mock data if no specific filters
    let mockOrders = [
    {
      id: 'ord_9aK3fQ',
      number: 'KSB-102348',
      created_at: '2025-07-29T14:32:10Z',
      updated_at: '2025-07-29T14:45:01Z',
      status: 'FULFILLED',
      customer: {
        id: 'cust_7x2',
        name: 'Elmwood Family Clinic'
      },
      totals: {
        subtotal: 412.50,
        shipping: 18.00,
        tax: 34.33,
        discount: 0,
        grand_total: 464.83,
        currency: 'USD'
      },
      shipping: {
        method: 'UPS_GROUND',
        address: {
          line1: '201 Main St',
          city: 'Springfield',
          state: 'IL',
          postal_code: '62701',
          country: 'US'
        },
        tracking: [
          {
            shipment_id: 'shp_5m2',
            carrier: 'UPS',
            tracking_number: '1Z999AA1234567890',
            status: 'DELIVERED',
            delivered_at: '2025-07-31T19:12:45Z'
          }
        ]
      },
      metadata: {
        source: 'kasbah',
        supplier_id: 'sup_abc'
      }
    },
    {
      id: 'ord_8bL2eP',
      number: 'KSB-102349',
      created_at: '2025-07-30T09:15:20Z',
      updated_at: '2025-07-30T09:15:20Z',
      status: 'PENDING',
      customer: {
        id: 'cust_8y3',
        name: 'Metro Health Center'
      },
      totals: {
        subtotal: 285.75,
        shipping: 12.00,
        tax: 23.86,
        discount: 15.00,
        grand_total: 306.61,
        currency: 'USD'
      },
      shipping: {
        method: 'FEDEX_GROUND',
        address: {
          line1: '1500 Broadway',
          line2: 'Suite 400',
          city: 'New York',
          state: 'NY',
          postal_code: '10018',
          country: 'US'
        },
        tracking: []
      },
      metadata: {
        source: 'kasbah',
        supplier_id: 'sup_def'
      }
    }
  ];
  
  // Apply filters
  if (status) {
    mockOrders = mockOrders.filter(order => order.status === status);
  }
  
  if (customer_id) {
    mockOrders = mockOrders.filter(order => order.customer.id === customer_id);
  }
  
  // Apply pagination
  const pageLimit = Math.min(parseInt(limit) || 50, 200);
  const paginatedOrders = mockOrders.slice(0, pageLimit);
  
  res.json({
    data: paginatedOrders,
    pagination: {
      limit: pageLimit,
      has_more: mockOrders.length > pageLimit,
      next_cursor: null
    }
  });
  
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      error: {
        type: 'internal',
        message: 'Error fetching orders',
        doc_url: 'https://developer.kasbah.health/docs/errors#internal',
        request_id: req.id || 'unknown'
      }
    });
  }
});

// New endpoint: Get orders by supplier ID
app.get('/v1/suppliers/:supplier_id/orders', authenticateRequest, addRateLimitHeaders, async (req, res) => {
  const { supplier_id } = req.params;
  const { status, limit, cursor } = req.query;
  
  try {
    const result = await ordersService.getOrdersBySupplierId(supplier_id, { status }, { 
      limit: parseInt(limit) || 50, 
      cursor 
    });
    
    res.json({
      data: result.orders,
      pagination: {
        limit: result.limit,
        has_more: result.hasMore,
        next_cursor: result.nextCursor
      }
    });
  } catch (error) {
    console.error('Error fetching supplier orders:', error);
    res.status(500).json({
      error: {
        type: 'internal',
        message: 'Error fetching supplier orders',
        doc_url: 'https://developer.kasbah.health/docs/errors#internal',
        request_id: req.id || 'unknown'
      }
    });
  }
});

// New endpoint: Get orders by buyer/customer ID
app.get('/v1/customers/:customer_id/orders', authenticateRequest, addRateLimitHeaders, async (req, res) => {
  const { customer_id } = req.params;
  const { status, limit, cursor } = req.query;
  
  try {
    const result = await ordersService.getOrdersByBuyerId(customer_id, { status }, { 
      limit: parseInt(limit) || 50, 
      cursor 
    });
    
    res.json({
      data: result.orders,
      pagination: {
        limit: result.limit,
        has_more: result.hasMore,
        next_cursor: result.nextCursor
      }
    });
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({
      error: {
        type: 'internal',
        message: 'Error fetching customer orders',
        doc_url: 'https://developer.kasbah.health/docs/errors#internal',
        request_id: req.id || 'unknown'
      }
    });
  }
});

// New endpoint: Get user information
app.get('/v1/users/:user_id', authenticateRequest, addRateLimitHeaders, async (req, res) => {
  const { user_id } = req.params;
  
  try {
    const user = await ordersService.getUser(user_id);
    
    if (!user) {
      return res.status(404).json({
        error: {
          type: 'not_found',
          message: 'User not found',
          doc_url: 'https://developer.kasbah.health/docs/errors#not_found',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: {
        type: 'internal',
        message: 'Error fetching user information',
        doc_url: 'https://developer.kasbah.health/docs/errors#internal',
        request_id: req.id || 'unknown'
      }
    });
  }
});

// New endpoint: Get products/inventory with 20-item limit
app.get('/v1/products', authenticateRequest, addRateLimitHeaders, async (req, res) => {
  const { category, supplier_id, limit, cursor } = req.query;
  
  try {
    const result = await ordersService.getProducts({ category, supplier_id }, { 
      limit: Math.min(parseInt(limit) || 20, 20), // Enforce 20-item max
      cursor 
    });
    
    res.json({
      data: result.products,
      pagination: {
        limit: result.limit,
        has_more: result.hasMore,
        next_cursor: result.nextCursor
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      error: {
        type: 'internal',
        message: 'Error fetching products',
        doc_url: 'https://developer.kasbah.health/docs/errors#internal',
        request_id: req.id || 'unknown'
      }
    });
  }
});

app.get('/v1/orders/:order_id', authenticateRequest, addRateLimitHeaders, (req, res) => {
  const orderId = req.params.order_id;
  
  if (orderId === 'ord_9aK3fQ') {
    res.json({
      id: 'ord_9aK3fQ',
      number: 'KSB-102348',
      created_at: '2025-07-29T14:32:10Z',
      updated_at: '2025-07-29T14:45:01Z',
      status: 'FULFILLED',
      customer: {
        id: 'cust_7x2',
        name: 'Elmwood Family Clinic'
      },
      totals: {
        subtotal: 412.50,
        shipping: 18.00,
        tax: 34.33,
        discount: 0,
        grand_total: 464.83,
        currency: 'USD'
      },
      items: [
        {
          item_id: 'it_1',
          sku: 'SC1616',
          name: 'Intermittent Straight Catheter',
          quantity: 200,
          uom: 'each',
          unit_price: 0.43,
          extended_price: 86.00
        }
      ],
      shipping: {
        method: 'UPS_GROUND',
        address: {
          line1: '201 Main St',
          city: 'Springfield',
          state: 'IL',
          postal_code: '62701',
          country: 'US'
        },
        tracking: [
          {
            shipment_id: 'shp_5m2',
            carrier: 'UPS',
            tracking_number: '1Z999AA1234567890',
            status: 'DELIVERED',
            delivered_at: '2025-07-31T19:12:45Z'
          }
        ]
      },
      metadata: {
        source: 'kasbah',
        supplier_id: 'sup_abc'
      }
    });
  } else if (orderId === 'ord_8bL2eP') {
    res.json({
      id: 'ord_8bL2eP',
      number: 'KSB-102349',
      created_at: '2025-07-30T09:15:20Z',
      updated_at: '2025-07-30T09:15:20Z',
      status: 'PENDING',
      customer: {
        id: 'cust_8y3',
        name: 'Metro Health Center'
      },
      totals: {
        subtotal: 285.75,
        shipping: 12.00,
        tax: 23.86,
        discount: 15.00,
        grand_total: 306.61,
        currency: 'USD'
      },
      metadata: {
        source: 'kasbah',
        supplier_id: 'sup_def'
      }
    });
  } else {
    res.status(404).json({
      error: {
        type: 'not_found',
        message: 'Order not found',
        doc_url: 'https://developer.kasbah.health/docs/errors#not_found',
        request_id: req.id || 'unknown'
      }
    });
  }
});

app.get('/v1/orders/:order_id/items', authenticateRequest, addRateLimitHeaders, (req, res) => {
  const orderId = req.params.order_id;
  
  if (orderId === 'ord_9aK3fQ') {
    res.json({
      data: [
        {
          item_id: 'it_1',
          sku: 'SC1616',
          name: 'Intermittent Straight Catheter',
          quantity: 200,
          uom: 'each',
          unit_price: 0.43,
          extended_price: 86.00,
          metadata: {}
        },
        {
          item_id: 'it_2',
          sku: 'GL2020',
          name: 'Nitrile Examination Gloves - Large',
          quantity: 10,
          uom: 'box',
          unit_price: 15.50,
          extended_price: 155.00,
          metadata: {}
        }
      ]
    });
  } else {
    res.status(404).json({
      error: {
        type: 'not_found',
        message: 'Order not found',
        doc_url: 'https://developer.kasbah.health/docs/errors#not_found',
        request_id: req.id || 'unknown'
      }
    });
  }
});

app.get('/v1/orders/:order_id/events', authenticateRequest, addRateLimitHeaders, (req, res) => {
  const orderId = req.params.order_id;
  
  if (orderId === 'ord_9aK3fQ') {
    res.json({
      data: [
        {
          id: 'evt_ghi789',
          type: 'order.fulfilled',
          status: 'FULFILLED',
          timestamp: '2025-07-29T14:45:01Z',
          message: 'Order fulfilled and shipped',
          metadata: { tracking_number: '1Z999AA1234567890' }
        },
        {
          id: 'evt_def456',
          type: 'order.approved',
          status: 'APPROVED',
          timestamp: '2025-07-29T14:40:00Z',
          message: 'Order approved by supplier',
          metadata: { approved_by: 'supplier_user_123' }
        },
        {
          id: 'evt_abc123',
          type: 'order.created',
          status: 'PENDING',
          timestamp: '2025-07-29T14:32:10Z',
          message: 'Order created and awaiting approval',
          metadata: {}
        }
      ]
    });
  } else {
    res.status(404).json({
      error: {
        type: 'not_found',
        message: 'Order not found',
        doc_url: 'https://developer.kasbah.health/docs/errors#not_found',
        request_id: req.id || 'unknown'
      }
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(500).json({
    error: {
      type: 'internal',
      message: 'An internal server error occurred',
      doc_url: 'https://developer.kasbah.health/docs/errors#internal',
      request_id: req.id || 'unknown'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      type: 'not_found',
      message: 'The requested endpoint was not found',
      doc_url: 'https://developer.kasbah.health/docs/errors#not_found',
      request_id: req.id || 'unknown'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Kasbah API server with authentication running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/v1/ping`);
  console.log(`🔐 Protected orders: http://localhost:${PORT}/v1/orders (requires auth)`);
  console.log(`👥 User info: http://localhost:${PORT}/v1/users/:user_id`);
  console.log(`📦 Products: http://localhost:${PORT}/v1/products`);
  console.log(`🏪 Supplier orders: http://localhost:${PORT}/v1/suppliers/:supplier_id/orders`);
  console.log(`🛒 Customer orders: http://localhost:${PORT}/v1/customers/:customer_id/orders`);
  console.log('');
  console.log('📝 Test API Keys:');
  console.log('  Live: pk_live_abc123 (secret: sk_live_secret123)');
  console.log('  Test: pk_test_xyz789 (secret: sk_test_secret789)');
});

module.exports = app;