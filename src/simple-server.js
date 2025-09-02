require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

// Minimal middleware
app.use(express.json());

// Simple routes without authentication
app.get('/v1/ping', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Simple mock orders endpoint
app.get('/v1/orders', (req, res) => {
  const mockOrders = [
    {
      id: 'ord_9aK3fQ',
      number: 'KSB-102348',
      created_at: '2025-07-29T14:32:10Z',
      status: 'FULFILLED',
      customer: {
        id: 'cust_7x2',
        name: 'Elmwood Family Clinic'
      },
      totals: {
        subtotal: 412.50,
        grand_total: 464.83,
        currency: 'USD'
      }
    }
  ];

  res.json({
    data: mockOrders,
    pagination: {
      limit: 50,
      has_more: false,
      next_cursor: null
    }
  });
});

app.get('/v1/orders/:order_id', (req, res) => {
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
      shipping: {
        method: 'UPS_GROUND',
        address: {
          line1: '201 Main St',
          city: 'Springfield',
          state: 'IL',
          postal_code: '62701',
          country: 'US'
        }
      }
    });
  } else {
    res.status(404).json({
      error: {
        type: 'not_found',
        message: 'Order not found'
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Simple Kasbah API server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/v1/ping`);
  console.log(`📦 Orders: http://localhost:${PORT}/v1/orders`);
});