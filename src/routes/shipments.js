const express = require('express');
const { query, param, validationResult } = require('express-validator');
const { ShipmentsService } = require('../services/firestore');
const { authenticateRequest, checkIpAllowlist } = require('../middleware/auth');

const router = express.Router();
const shipmentsService = new ShipmentsService();

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
 * /v1/shipments:
 *   get:
 *     summary: List shipments with tracking information
 *     tags: [Shipments]
 *     security:
 *       - KasbahAuth: []
 *     parameters:
 *       - in: query
 *         name: order_id
 *         schema:
 *           type: string
 *         description: Filter by order ID
 *       - in: query
 *         name: carrier
 *         schema:
 *           type: string
 *           enum: [UPS, FEDEX, USPS, DHL]
 *         description: Filter by carrier
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [CREATED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION]
 *         description: Filter by shipment status
 *       - in: query
 *         name: created_at[gte]
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter shipments created after this timestamp
 *       - in: query
 *         name: created_at[lte]
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter shipments created before this timestamp
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
 *     responses:
 *       200:
 *         description: List of shipments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Shipment'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', [
  authenticateRequest,
  checkIpAllowlist,
  
  // Validation middleware
  query('order_id').optional().isLength({ min: 1 })
    .withMessage('order_id must not be empty'),
  query('carrier').optional().isIn(['UPS', 'FEDEX', 'USPS', 'DHL'])
    .withMessage('carrier must be one of: UPS, FEDEX, USPS, DHL'),
  query('status').optional().isIn(['CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION'])
    .withMessage('status must be one of: CREATED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION'),
  query('created_at[gte]').optional().isISO8601()
    .withMessage('created_at[gte] must be a valid ISO-8601 datetime'),
  query('created_at[lte]').optional().isISO8601()
    .withMessage('created_at[lte] must be a valid ISO-8601 datetime'),
  query('limit').optional().isInt({ min: 1, max: 200 })
    .withMessage('limit must be between 1 and 200'),
  query('cursor').optional().isBase64()
    .withMessage('cursor must be a valid base64 encoded string'),
    
  handleValidationErrors
], async (req, res, next) => {
  try {
    const filters = {
      order_id: req.query.order_id,
      carrier: req.query.carrier,
      status: req.query.status,
      created_at_gte: req.query['created_at[gte]'],
      created_at_lte: req.query['created_at[lte]']
    };
    
    const pagination = {
      limit: req.query.limit,
      cursor: req.query.cursor
    };
    
    const result = await shipmentsService.listShipments(filters, pagination);
    
    res.set({
      'X-RateLimit-Limit': '600',
      'X-RateLimit-Remaining': '599',
      'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 60
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error in GET /v1/shipments:', error);
    next(error);
  }
});

/**
 * @swagger
 * /v1/shipments/{shipment_id}:
 *   get:
 *     summary: Retrieve a specific shipment with tracking details
 *     tags: [Shipments]
 *     security:
 *       - KasbahAuth: []
 *     parameters:
 *       - in: path
 *         name: shipment_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The shipment ID
 *     responses:
 *       200:
 *         description: Shipment details with tracking information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Shipment'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/:shipment_id', [
  authenticateRequest,
  checkIpAllowlist,
  
  param('shipment_id').isLength({ min: 1 })
    .withMessage('shipment_id is required and must not be empty'),
    
  handleValidationErrors
], async (req, res, next) => {
  try {
    const shipment = await shipmentsService.getShipment(req.params.shipment_id);
    
    if (!shipment) {
      return res.status(404).json({
        error: {
          type: 'not_found',
          message: 'Shipment not found',
          doc_url: 'https://developer.kasbah.health/docs/errors#not_found',
          request_id: req.id || 'unknown'
        }
      });
    }
    
    res.json(shipment);
    
  } catch (error) {
    console.error(`Error in GET /v1/shipments/${req.params.shipment_id}:`, error);
    next(error);
  }
});

module.exports = router;