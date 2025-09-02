require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting - temporarily disabled for testing
// const limiter = rateLimit({
//   windowMs: 60 * 1000, // 1 minute
//   max: 600, // 600 requests per minute (burst)
//   message: {
//     error: {
//       type: 'rate_limited',
//       message: 'Too many requests, please try again later',
//       doc_url: 'https://developer.kasbah.health/docs/errors#rate_limited'
//     }
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   handler: (req, res) => {
//     res.status(429).json({
//       error: {
//         type: 'rate_limited',
//         message: 'Too many requests, please try again later',
//         doc_url: 'https://developer.kasbah.health/docs/errors#rate_limited',
//         request_id: req.id || 'unknown'
//       }
//     });
//   }
// });

// app.use('/v1', limiter);

// Swagger setup - temporarily disabled
// const swaggerOptions = {
//   definition: {
//     openapi: '3.0.3',
//     info: {
//       title: 'Kasbah Orders API',
//       version: '1.0.0',
//       description: 'Partner API for accessing order data with comprehensive filtering and webhook support',
//       contact: {
//         name: 'Kasbah API Support',
//         url: 'https://kasbah.health',
//         email: 'api@kasbah.health'
//       }
//     },
//     servers: [
//       {
//         url: process.env.API_BASE_URL || 'https://api.kasbah.health',
//         description: 'Production server'
//       },
//       {
//         url: 'http://localhost:3001',
//         description: 'Development server'
//       }
//     ],
//     components: {
//       securitySchemes: {
//         KasbahAuth: {
//           type: 'apiKey',
//           in: 'header',
//           name: 'Kasbah-Key',
//           description: 'API key authentication with HMAC signature'
//         }
//       }
//     },
//     security: [
//       {
//         KasbahAuth: []
//       }
//     ]
//   },
//   apis: [] // Temporarily disable swagger-jsdoc to identify the issue
// };

// const swaggerSpec = swaggerJsdoc(swaggerOptions);
// app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/v1/ping', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Raw body capture for HMAC validation - moved before routes
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

// API routes - temporarily commented out to test
// app.use('/v1/orders', require('./routes/orders'));
// app.use('/v1/shipments', require('./routes/shipments'));
// app.use('/v1/webhooks', require('./routes/webhooks'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const requestId = req.id || 'unknown';
  
  if (err.type === 'unauthorized') {
    return res.status(401).json({
      error: {
        type: 'unauthorized',
        message: 'Invalid or missing authentication credentials',
        doc_url: 'https://developer.kasbah.health/docs/errors#unauthorized',
        request_id: requestId
      }
    });
  }
  
  if (err.type === 'forbidden') {
    return res.status(403).json({
      error: {
        type: 'forbidden',
        message: 'Insufficient permissions for this resource',
        doc_url: 'https://developer.kasbah.health/docs/errors#forbidden',
        request_id: requestId
      }
    });
  }
  
  if (err.type === 'not_found') {
    return res.status(404).json({
      error: {
        type: 'not_found',
        message: 'The requested resource was not found',
        doc_url: 'https://developer.kasbah.health/docs/errors#not_found',
        request_id: requestId
      }
    });
  }
  
  // Default to internal server error
  res.status(500).json({
    error: {
      type: 'internal',
      message: 'An internal server error occurred',
      doc_url: 'https://developer.kasbah.health/docs/errors#internal',
      request_id: requestId
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
  console.log(`🚀 Kasbah API server running on port ${PORT}`);
  console.log(`📚 API documentation available at http://localhost:${PORT}/docs`);
  console.log(`🏥 Health check available at http://localhost:${PORT}/v1/ping`);
});

module.exports = app;