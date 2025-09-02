/**
 * OpenAPI Schema Definitions for the Kasbah API
 * 
 * These schemas define the structure of API responses and are used
 * for OpenAPI documentation generation and validation.
 */

const schemas = {
  /**
   * @swagger
   * components:
   *   schemas:
   *     Order:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *           example: ord_9aK3fQ
   *           description: Unique order identifier
   *         number:
   *           type: string
   *           example: KSB-102348
   *           description: Human-readable order number
   *         created_at:
   *           type: string
   *           format: date-time
   *           example: 2025-07-29T14:32:10Z
   *           description: Order creation timestamp
   *         updated_at:
   *           type: string
   *           format: date-time
   *           example: 2025-07-29T14:45:01Z
   *           description: Last update timestamp
   *         status:
   *           type: string
   *           enum: [PENDING, APPROVED, FULFILLED, CANCELLED]
   *           example: FULFILLED
   *           description: Current order status
   *         customer:
   *           type: object
   *           properties:
   *             id:
   *               type: string
   *               example: cust_7x2
   *             name:
   *               type: string
   *               example: Elmwood Family Clinic
   *         totals:
   *           type: object
   *           properties:
   *             subtotal:
   *               type: number
   *               format: decimal
   *               example: 412.50
   *             shipping:
   *               type: number
   *               format: decimal
   *               example: 18.00
   *             tax:
   *               type: number
   *               format: decimal
   *               example: 34.33
   *             discount:
   *               type: number
   *               format: decimal
   *               example: 0
   *             grand_total:
   *               type: number
   *               format: decimal
   *               example: 464.83
   *             currency:
   *               type: string
   *               example: USD
   *               enum: [USD, CAD, EUR]
   *         items:
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/OrderItem'
   *         shipping:
   *           type: object
   *           properties:
   *             method:
   *               type: string
   *               example: UPS_GROUND
   *             address:
   *               $ref: '#/components/schemas/Address'
   *             tracking:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TrackingInfo'
   *         metadata:
   *           type: object
   *           properties:
   *             source:
   *               type: string
   *               example: kasbah
   *             supplier_id:
   *               type: string
   *               example: sup_abc
   *             external_id:
   *               type: string
   *               nullable: true
   *       required:
   *         - id
   *         - number
   *         - created_at
   *         - status
   *         - customer
   *         - totals
   */

  /**
   * @swagger
   * components:
   *   schemas:
   *     OrderItem:
   *       type: object
   *       properties:
   *         item_id:
   *           type: string
   *           example: it_1
   *           description: Line item identifier
   *         sku:
   *           type: string
   *           example: SC1616
   *           description: Product SKU
   *         name:
   *           type: string
   *           example: Intermittent Straight Catheter
   *           description: Product name
   *         quantity:
   *           type: integer
   *           example: 200
   *           description: Ordered quantity
   *         uom:
   *           type: string
   *           example: each
   *           description: Unit of measure
   *         unit_price:
   *           type: number
   *           format: decimal
   *           example: 0.43
   *           description: Price per unit
   *         extended_price:
   *           type: number
   *           format: decimal
   *           example: 86.00
   *           description: Total line item price
   *         metadata:
   *           type: object
   *           additionalProperties: true
   *       required:
   *         - item_id
   *         - sku
   *         - name
   *         - quantity
   *         - unit_price
   *         - extended_price
   */

  /**
   * @swagger
   * components:
   *   schemas:
   *     OrderEvent:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *           example: evt_abc123
   *         type:
   *           type: string
   *           enum: [order.created, order.approved, order.fulfilled, order.cancelled, order.updated]
   *           example: order.fulfilled
   *         status:
   *           type: string
   *           example: FULFILLED
   *         timestamp:
   *           type: string
   *           format: date-time
   *           example: 2025-07-29T14:45:01Z
   *         message:
   *           type: string
   *           example: Order has been fulfilled and shipped
   *         metadata:
   *           type: object
   *           additionalProperties: true
   */

  /**
   * @swagger
   * components:
   *   schemas:
   *     Shipment:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *           example: shp_5m2
   *         order_id:
   *           type: string
   *           example: ord_9aK3fQ
   *         carrier:
   *           type: string
   *           enum: [UPS, FEDEX, USPS, DHL]
   *           example: UPS
   *         tracking_number:
   *           type: string
   *           example: 1Z999AA1234567890
   *         status:
   *           type: string
   *           enum: [CREATED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION]
   *           example: DELIVERED
   *         shipped_at:
   *           type: string
   *           format: date-time
   *           example: 2025-07-30T09:15:00Z
   *         delivered_at:
   *           type: string
   *           format: date-time
   *           nullable: true
   *           example: 2025-07-31T19:12:45Z
   *         tracking_events:
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/TrackingEvent'
   *         items:
   *           type: array
   *           items:
   *             type: object
   *             properties:
   *               item_id:
   *                 type: string
   *               sku:
   *                 type: string
   *               quantity_shipped:
   *                 type: integer
   */

  /**
   * @swagger
   * components:
   *   schemas:
   *     TrackingInfo:
   *       type: object
   *       properties:
   *         shipment_id:
   *           type: string
   *           example: shp_5m2
   *         carrier:
   *           type: string
   *           example: UPS
   *         tracking_number:
   *           type: string
   *           example: 1Z999AA1234567890
   *         status:
   *           type: string
   *           example: DELIVERED
   *         delivered_at:
   *           type: string
   *           format: date-time
   *           nullable: true
   *           example: 2025-07-31T19:12:45Z
   */

  /**
   * @swagger
   * components:
   *   schemas:
   *     TrackingEvent:
   *       type: object
   *       properties:
   *         timestamp:
   *           type: string
   *           format: date-time
   *           example: 2025-07-31T19:12:45Z
   *         status:
   *           type: string
   *           example: DELIVERED
   *         location:
   *           type: string
   *           example: Springfield, IL
   *         description:
   *           type: string
   *           example: Package delivered to recipient
   */

  /**
   * @swagger
   * components:
   *   schemas:
   *     Address:
   *       type: object
   *       properties:
   *         line1:
   *           type: string
   *           example: 201 Main St
   *         line2:
   *           type: string
   *           nullable: true
   *           example: Suite 100
   *         city:
   *           type: string
   *           example: Springfield
   *         state:
   *           type: string
   *           example: IL
   *         postal_code:
   *           type: string
   *           example: 62701
   *         country:
   *           type: string
   *           example: US
   *       required:
   *         - line1
   *         - city
   *         - state
   *         - postal_code
   *         - country
   */

  /**
   * @swagger
   * components:
   *   schemas:
   *     Webhook:
   *       type: object
   *       properties:
   *         id:
   *           type: string
   *           example: wh_abc123def456
   *         partner_id:
   *           type: string
   *           example: partner_1
   *         url:
   *           type: string
   *           format: uri
   *           example: https://partner.example.com/kasbah/webhooks
   *         events:
   *           type: array
   *           items:
   *             type: string
   *             enum: [order.created, order.updated, shipment.created, shipment.delivered, return.created]
   *           example: [order.created, order.updated]
   *         status:
   *           type: string
   *           enum: [active, inactive]
   *           example: active
   *         description:
   *           type: string
   *           nullable: true
   *           example: Production webhook for order updates
   *         created_at:
   *           type: string
   *           format: date-time
   *           example: 2025-09-01T10:00:00Z
   *         updated_at:
   *           type: string
   *           format: date-time
   *           example: 2025-09-01T10:00:00Z
   *         last_delivery:
   *           type: string
   *           format: date-time
   *           nullable: true
   *           example: 2025-09-01T14:30:00Z
   *         delivery_stats:
   *           type: object
   *           properties:
   *             total_deliveries:
   *               type: integer
   *               example: 42
   *             successful_deliveries:
   *               type: integer
   *               example: 40
   *             failed_deliveries:
   *               type: integer
   *               example: 2
   */

  /**
   * @swagger
   * components:
   *   schemas:
   *     Pagination:
   *       type: object
   *       properties:
   *         limit:
   *           type: integer
   *           example: 50
   *           description: Number of items requested
   *         has_more:
   *           type: boolean
   *           example: true
   *           description: Whether there are more results available
   *         next_cursor:
   *           type: string
   *           nullable: true
   *           example: eyJjcmVhdGVkX2F0IjoiMjAyNS0wNy0yOVQxNDozMjoxMFoiLCJpZCI6Im9yZF85YUszZlEifQ==
   *           description: Cursor for fetching next page of results
   */

  /**
   * @swagger
   * components:
   *   schemas:
   *     Error:
   *       type: object
   *       properties:
   *         error:
   *           type: object
   *           properties:
   *             type:
   *               type: string
   *               enum: [invalid_request, unauthorized, forbidden, not_found, rate_limited, conflict, internal]
   *               example: not_found
   *             message:
   *               type: string
   *               example: The requested resource was not found
   *             doc_url:
   *               type: string
   *               format: uri
   *               example: https://developer.kasbah.health/docs/errors#not_found
   *             request_id:
   *               type: string
   *               example: req_abc123
   *             details:
   *               type: array
   *               items:
   *                 type: object
   *               description: Additional error details (for validation errors)
   *       required:
   *         - error
   */

  /**
   * @swagger
   * components:
   *   responses:
   *     Unauthorized:
   *       description: Authentication required or invalid credentials
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Error'
   *     Forbidden:
   *       description: Insufficient permissions
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Error'
   *     NotFound:
   *       description: Resource not found
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Error'
   *     BadRequest:
   *       description: Invalid request parameters
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Error'
   *     RateLimit:
   *       description: Rate limit exceeded
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Error'
   *       headers:
   *         X-RateLimit-Limit:
   *           schema:
   *             type: integer
   *           description: The rate limit ceiling for that given endpoint
   *         X-RateLimit-Remaining:
   *           schema:
   *             type: integer
   *           description: The number of requests left for the time window
   *         Retry-After:
   *           schema:
   *             type: integer
   *           description: The number of seconds to wait before retrying
   */
};

module.exports = schemas;