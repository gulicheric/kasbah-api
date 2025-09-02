const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateRequest, checkIpAllowlist } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

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
 * /v1/webhooks:
 *   get:
 *     summary: List registered webhooks for the authenticated partner
 *     tags: [Webhooks]
 *     security:
 *       - KasbahAuth: []
 *     responses:
 *       200:
 *         description: List of registered webhooks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Webhook'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', [
  authenticateRequest,
  checkIpAllowlist
], async (req, res, next) => {
  try {
    // Mock response - in production, this would query the database
    const webhooks = [
      {
        id: 'wh_' + uuidv4().slice(0, 8),
        url: 'https://partner.example.com/kasbah/webhooks',
        events: ['order.created', 'order.updated', 'shipment.delivered'],
        status: 'active',
        created_at: '2025-09-01T10:00:00Z',
        updated_at: '2025-09-01T10:00:00Z'
      }
    ];
    
    res.json({ data: webhooks });
    
  } catch (error) {
    console.error('Error in GET /v1/webhooks:', error);
    next(error);
  }
});

/**
 * @swagger
 * /v1/webhooks:
 *   post:
 *     summary: Register a new webhook endpoint
 *     tags: [Webhooks]
 *     security:
 *       - KasbahAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - events
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: The webhook endpoint URL
 *                 example: https://partner.example.com/kasbah/webhooks
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [order.created, order.updated, shipment.created, shipment.delivered, return.created]
 *                 description: List of events to subscribe to
 *                 example: [order.created, order.updated]
 *               secret:
 *                 type: string
 *                 description: Optional webhook secret for signature validation
 *               description:
 *                 type: string
 *                 description: Optional description for this webhook
 *     responses:
 *       201:
 *         description: Webhook registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Webhook'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', [
  authenticateRequest,
  checkIpAllowlist,
  
  body('url').isURL({ require_protocol: true })
    .withMessage('url must be a valid HTTPS URL')
    .custom(value => {
      if (!value.startsWith('https://')) {
        throw new Error('url must use HTTPS protocol');
      }
      return true;
    }),
  body('events').isArray({ min: 1 })
    .withMessage('events must be a non-empty array')
    .custom(events => {
      const validEvents = ['order.created', 'order.updated', 'shipment.created', 'shipment.delivered', 'return.created'];
      const invalidEvents = events.filter(event => !validEvents.includes(event));
      if (invalidEvents.length > 0) {
        throw new Error(`Invalid events: ${invalidEvents.join(', ')}. Valid events: ${validEvents.join(', ')}`);
      }
      return true;
    }),
  body('secret').optional().isLength({ min: 8 })
    .withMessage('secret must be at least 8 characters long'),
  body('description').optional().isLength({ max: 500 })
    .withMessage('description must not exceed 500 characters'),
    
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { url, events, secret, description } = req.body;
    const partnerId = req.partner.id;
    
    // Generate webhook ID and secret if not provided
    const webhookId = 'wh_' + uuidv4().replace(/-/g, '').slice(0, 16);
    const webhookSecret = secret || 'whsec_' + uuidv4().replace(/-/g, '');
    
    // In production, save to database
    const webhook = {
      id: webhookId,
      partner_id: partnerId,
      url,
      events,
      secret: webhookSecret,
      description: description || null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_delivery: null,
      delivery_stats: {
        total_deliveries: 0,
        successful_deliveries: 0,
        failed_deliveries: 0
      }
    };
    
    console.log(`📡 Webhook registered for partner ${partnerId}:`, {
      id: webhookId,
      url,
      events
    });
    
    res.status(201).json(webhook);
    
  } catch (error) {
    console.error('Error in POST /v1/webhooks:', error);
    next(error);
  }
});

/**
 * @swagger
 * /v1/webhooks/{webhook_id}:
 *   get:
 *     summary: Get details of a specific webhook
 *     tags: [Webhooks]
 *     security:
 *       - KasbahAuth: []
 *     parameters:
 *       - in: path
 *         name: webhook_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The webhook ID
 *     responses:
 *       200:
 *         description: Webhook details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Webhook'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:webhook_id', [
  authenticateRequest,
  checkIpAllowlist,
  
  param('webhook_id').matches(/^wh_[a-zA-Z0-9]+$/)
    .withMessage('webhook_id must be a valid webhook ID'),
    
  handleValidationErrors
], async (req, res, next) => {
  try {
    const webhookId = req.params.webhook_id;
    
    // Mock response - in production, query database
    const webhook = {
      id: webhookId,
      partner_id: req.partner.id,
      url: 'https://partner.example.com/kasbah/webhooks',
      events: ['order.created', 'order.updated'],
      status: 'active',
      created_at: '2025-09-01T10:00:00Z',
      updated_at: '2025-09-01T10:00:00Z',
      last_delivery: '2025-09-01T14:30:00Z',
      delivery_stats: {
        total_deliveries: 42,
        successful_deliveries: 40,
        failed_deliveries: 2
      }
    };
    
    res.json(webhook);
    
  } catch (error) {
    console.error(`Error in GET /v1/webhooks/${req.params.webhook_id}:`, error);
    next(error);
  }
});

/**
 * @swagger
 * /v1/webhooks/{webhook_id}:
 *   delete:
 *     summary: Delete a webhook
 *     tags: [Webhooks]
 *     security:
 *       - KasbahAuth: []
 *     parameters:
 *       - in: path
 *         name: webhook_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The webhook ID
 *     responses:
 *       204:
 *         description: Webhook deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:webhook_id', [
  authenticateRequest,
  checkIpAllowlist,
  
  param('webhook_id').matches(/^wh_[a-zA-Z0-9]+$/)
    .withMessage('webhook_id must be a valid webhook ID'),
    
  handleValidationErrors
], async (req, res, next) => {
  try {
    const webhookId = req.params.webhook_id;
    const partnerId = req.partner.id;
    
    // In production, delete from database
    console.log(`🗑️  Webhook deleted: ${webhookId} for partner ${partnerId}`);
    
    res.status(204).send();
    
  } catch (error) {
    console.error(`Error in DELETE /v1/webhooks/${req.params.webhook_id}:`, error);
    next(error);
  }
});

module.exports = router;