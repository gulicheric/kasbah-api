const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { OrdersService } = require('../services/firestore');
const { authenticateRequest, checkIpAllowlist } = require('../middleware/auth');

const router = express.Router();
const ordersService = new OrdersService();

/**
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        type: 'invalid_request',
        message: 'Validation failed',
        details: errors.array(),
        doc_url: 'https://developer.kasbah.health/docs/errors#invalid_request',
        request_id: req.id || 'unknown'
      }
    });
  }
  next();
};

/**
 * @swagger
 * /v1/orders:
 *   get:
 *     summary: List orders with filtering and pagination
 *     tags: [Orders]
 *     security:
 *       - KasbahAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, FULFILLED, CANCELLED]
 *         description: Filter by order status
 *       - in: query
 *         name: created_at[gte]
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter orders created after this timestamp
 *       - in: query
 *         name: created_at[lte]
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter orders created before this timestamp
 *       - in: query
 *         name: updated_at[gte]
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter orders updated after this timestamp
 *       - in: query
 *         name: updated_at[lte]
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter orders updated before this timestamp
 *       - in: query
 *         name: customer_id
 *         schema:
 *           type: string
 *         description: Filter by customer ID
 *       - in: query
 *         name: supplier_id
 *         schema:
 *           type: string
 *         description: Filter by supplier ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *         description: Number of results to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor from previous response
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, -created_at, updated_at, -updated_at]
 *           default: -created_at
 *         description: Sort field and direction (- prefix for descending)
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       429:
 *         $ref: '#/components/responses/RateLimit'
 */
router.get('/', [
  authenticateRequest,
  checkIpAllowlist,
  
  // Validation middleware
  query('status').optional().isIn(['PENDING', 'APPROVED', 'FULFILLED', 'CANCELLED'])
    .withMessage('Status must be one of: PENDING, APPROVED, FULFILLED, CANCELLED'),
  query('created_at[gte]').optional().isISO8601()
    .withMessage('created_at[gte] must be a valid ISO-8601 datetime'),
  query('created_at[lte]').optional().isISO8601()
    .withMessage('created_at[lte] must be a valid ISO-8601 datetime'),
  query('updated_at[gte]').optional().isISO8601()
    .withMessage('updated_at[gte] must be a valid ISO-8601 datetime'),
  query('updated_at[lte]').optional().isISO8601()
    .withMessage('updated_at[lte] must be a valid ISO-8601 datetime'),
  query('customer_id').optional().isLength({ min: 1 })
    .withMessage('customer_id must not be empty'),
  query('supplier_id').optional().isLength({ min: 1 })
    .withMessage('supplier_id must not be empty'),
  query('limit').optional().isInt({ min: 1, max: 200 })
    .withMessage('limit must be between 1 and 200'),
  query('cursor').optional().isBase64()
    .withMessage('cursor must be a valid base64 encoded string'),
  query('sort').optional().isIn(['created_at', '-created_at', 'updated_at', '-updated_at'])
    .withMessage('sort must be one of: created_at, -created_at, updated_at, -updated_at'),
    
  handleValidationErrors
], async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      customer_id: req.query.customer_id,
      supplier_id: req.query.supplier_id,
      created_at_gte: req.query['created_at[gte]'],
      created_at_lte: req.query['created_at[lte]'],
      updated_at_gte: req.query['updated_at[gte]'],
      updated_at_lte: req.query['updated_at[lte]']
    };
    
    const pagination = {
      limit: req.query.limit,
      cursor: req.query.cursor,
      sort: req.query.sort || '-created_at'
    };
    
    const result = await ordersService.listOrders(filters, pagination);
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': '600',
      'X-RateLimit-Remaining': '599', // Would be calculated from actual rate limiter
      'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 60
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error in GET /v1/orders:', error);
    next(error);
  }
});

/**
 * @swagger
 * /v1/orders/{order_id}:
 *   get:
 *     summary: Retrieve a specific order
 *     tags: [Orders]
 *     security:
 *       - KasbahAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID
 *     responses:
 *       200:
 *         description: Order details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/:order_id', [
  authenticateRequest,
  checkIpAllowlist,
  
  param('order_id').isLength({ min: 1 })
    .withMessage('order_id is required and must not be empty'),
    
  handleValidationErrors
], async (req, res, next) => {
  try {
    const order = await ordersService.getOrder(req.params.order_id);
    
    if (!order) {
      return res.status(404).json({
        error: {
          type: 'not_found',
          message: 'Order not found',
          doc_url: 'https://developer.kasbah.health/docs/errors#not_found',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    res.json(order);
    
  } catch (error) {
    console.error(`Error in GET /v1/orders/${req.params.order_id}:`, error);
    next(error);
  }
});

/**
 * @swagger
 * /v1/orders/{order_id}/items:
 *   get:
 *     summary: Get order line items
 *     tags: [Orders]
 *     security:
 *       - KasbahAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID
 *     responses:
 *       200:
 *         description: Order line items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrderItem'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:order_id/items', [
  authenticateRequest,
  checkIpAllowlist,
  
  param('order_id').isLength({ min: 1 })
    .withMessage('order_id is required and must not be empty'),
    
  handleValidationErrors
], async (req, res, next) => {
  try {
    // First check if order exists
    const order = await ordersService.getOrder(req.params.order_id);
    if (!order) {
      return res.status(404).json({
        error: {
          type: 'not_found',
          message: 'Order not found',
          doc_url: 'https://developer.kasbah.health/docs/errors#not_found',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    const items = await ordersService.getOrderItems(req.params.order_id);
    res.json({ data: items });
    
  } catch (error) {
    console.error(`Error in GET /v1/orders/${req.params.order_id}/items:`, error);
    next(error);
  }
});

/**
 * @swagger
 * /v1/orders/{order_id}/events:
 *   get:
 *     summary: Get order status history and events
 *     tags: [Orders]
 *     security:
 *       - KasbahAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID
 *     responses:
 *       200:
 *         description: Order events and status history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrderEvent'
 */
router.get('/:order_id/events', [
  authenticateRequest,
  checkIpAllowlist,
  
  param('order_id').isLength({ min: 1 })
    .withMessage('order_id is required and must not be empty'),
    
  handleValidationErrors
], async (req, res, next) => {
  try {
    // First check if order exists
    const order = await ordersService.getOrder(req.params.order_id);
    if (!order) {
      return res.status(404).json({
        error: {
          type: 'not_found',
          message: 'Order not found',
          doc_url: 'https://developer.kasbah.health/docs/errors#not_found',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    const events = await ordersService.getOrderEvents(req.params.order_id);
    res.json({ data: events });
    
  } catch (error) {
    console.error(`Error in GET /v1/orders/${req.params.order_id}/events:`, error);
    next(error);
  }
});

module.exports = router;