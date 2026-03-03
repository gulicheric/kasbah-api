/**
 * @openapi
 * components:
 *   securitySchemes:
 *     KasbahKey:
 *       type: apiKey
 *       in: header
 *       name: Kasbah-Key
 *   parameters:
 *     IdempotencyKey:
 *       name: Idempotency-Key
 *       in: header
 *       required: false
 *       description: Idempotency token for safely retrying POST requests
 *       schema:
 *         type: string
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         email: { type: string, format: email }
 *         name: { type: string, nullable: true }
 *         role: { type: string, example: buyer }
 *         company:
 *           type: object
 *           properties:
 *             name: { type: string, nullable: true }
 *             type: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time, nullable: true }
 *         updated_at: { type: string, format: date-time, nullable: true }
 *         profile:
 *           type: object
 *           properties:
 *             phone: { type: string, nullable: true }
 *             address: { type: string, nullable: true }
 *             timezone: { type: string, nullable: true }
 *         metadata:
 *           type: object
 *           properties:
 *             source: { type: string, example: kasbah }
 *             last_login: { type: string, format: date-time, nullable: true }
 *             email_verified: { type: boolean }
 *     Pagination:
 *       type: object
 *       properties:
 *         limit: { type: integer, example: 50 }
 *         has_more: { type: boolean, example: false }
 *         next_cursor: { type: string, nullable: true, example: null }
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: object
 *           properties:
 *             type: { type: string, example: unauthorized }
 *             message: { type: string, example: Invalid API key }
 *     Product:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         sku: { type: string }
 *         name: { type: string }
 *         description: { type: string }
 *         category: { type: string }
 *         price: { type: number }
 *         uom: { type: string }
 *         supplier:
 *           type: object
 *           properties:
 *             id: { type: string }
 *             name: { type: string }
 *         inventory:
 *           type: object
 *           properties:
 *             available: { type: boolean }
 *             quantity: { type: integer }
 *             status: { type: string }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     SupplierOrderItem:
 *       type: object
 *       properties:
 *         item_id: { type: string }
 *         product_id: { type: string }
 *         sku: { type: string }
 *         name: { type: string }
 *         quantity: { type: integer }
 *         uom: { type: string }
 *         unit_price: { type: number }
 *         extended_price: { type: number }
 *     SupplierOrder:
 *       type: object
 *       properties:
 *         supplier_id: { type: string }
 *         supplier_name: { type: string }
 *         status: { type: string }
 *         subtotal: { type: number }
 *         items_count: { type: integer }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/SupplierOrderItem' }
 *     Order:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         order_number: { type: string }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *         status: { type: string }
 *         customer:
 *           type: object
 *           properties:
 *             id: { type: string }
 *             name: { type: string }
 *             email: { type: string }
 *         totals:
 *           type: object
 *           properties:
 *             grand_total: { type: number }
 *             currency: { type: string, example: USD }
 *         suppliers:
 *           type: array
 *           items: { $ref: '#/components/schemas/SupplierOrder' }
 *         summary:
 *           type: object
 *           properties:
 *             total_suppliers: { type: integer }
 *             total_items: { type: integer }
 *     OrdersListResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/Order' }
 *         pagination: { $ref: '#/components/schemas/Pagination' }
 *   responses:
 *     Unauthorized:
 *       description: Invalid or missing API key
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *     RateLimit:
 *       description: Rate limit exceeded
 *       headers:
 *         X-RateLimit-Limit: { description: Requests allowed per hour, schema: { type: integer } }
 *         X-RateLimit-Remaining: { description: Requests remaining in the window, schema: { type: integer } }
 *         X-RateLimit-Reset: { description: Reset time (epoch seconds), schema: { type: integer, format: int64 } }
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 *     NotImplemented:
 *       description: Not implemented
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

/**
 * @openapi
 * /v1/ping:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 timestamp: { type: string }
 *                 version: { type: string }
 */

/**
 * @openapi
 * /v1/orders:
 *   get:
 *     summary: List orders (by customer or supplier)
 *     parameters:
 *       - in: header
 *         name: Kasbah-Key
 *         schema: { type: string }
 *         required: true
 *       - in: query
 *         name: customer_id
 *         schema: { type: string, example: Bzuz0jKe63QU6Jso3TgWnmrEeZl2 }
 *       - in: query
 *         name: supplier_id
 *         schema: { type: string, example: gKjztAPj6vXaQde6NdektCmDdyZ2 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: A list of orders
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrdersListResponse' }
 *       401:
 *         description: Invalid API key
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

/**
 * @openapi
 * /v1/orders/{order_id}:
 *   get:
 *     summary: Get order details
 *     parameters:
 *       - in: header
 *         name: Kasbah-Key
 *         schema: { type: string }
 *         required: true
 *       - in: path
 *         name: order_id
 *         schema: { type: string, example: ORD-2025-413802 }
 *         required: true
 *     responses:
 *       200:
 *         description: Order details
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Order' }
 *       404:
 *         description: Not found
 */

/**
 * @openapi
 * /v1/customers/{customer_id}/orders:
 *   get:
 *     summary: List orders for a customer
 *     parameters:
 *       - in: header
 *         name: Kasbah-Key
 *         schema: { type: string }
 *         required: true
 *       - in: path
 *         name: customer_id
 *         schema: { type: string, example: Bzuz0jKe63QU6Jso3TgWnmrEeZl2 }
 *         required: true
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: A list of orders
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrdersListResponse' }
 */

/**
 * @openapi
 * /v1/suppliers/{supplier_id}/orders:
 *   get:
 *     summary: List orders for a supplier
 *     parameters:
 *       - in: header
 *         name: Kasbah-Key
 *         schema: { type: string }
 *         required: true
 *       - in: path
 *         name: supplier_id
 *         schema: { type: string, example: gKjztAPj6vXaQde6NdektCmDdyZ2 }
 *         required: true
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: A list of supplier orders
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/OrdersListResponse' }
 */

/**
 * @openapi
 * /v1/products:
 *   get:
 *     summary: List products (max 20 per page)
 *     parameters:
 *       - in: header
 *         name: Kasbah-Key
 *         schema: { type: string }
 *         required: true
 *       - in: query
 *         name: supplier_id
 *         schema: { type: string, example: Ko17o5hoPwdSVhZvooA6C8lUSG63 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 20 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: A list of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *                 pagination: { $ref: '#/components/schemas/Pagination' }
 */

/**
 * @openapi
 * /v1/users/{user_id}:
 *   get:
 *     summary: Get user details
 *     security:
 *       - KasbahKey: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         schema: { type: string }
 *         required: true
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Not found
 */

/**
 * @openapi
 * /v1/orders/{order_id}/items:
 *   get:
 *     summary: List items for an order (flattened)
 *     security:
 *       - KasbahKey: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         schema: { type: string }
 *         required: true
 *     responses:
 *       200:
 *         description: Items for the order
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SupplierOrderItem' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Order not found
 */

/**
 * @openapi
 * /v1/orders/{order_id}/events:
 *   get:
 *     summary: List events for an order
 *     security:
 *       - KasbahKey: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         schema: { type: string }
 *         required: true
 *     responses:
 *       501:
 *         $ref: '#/components/responses/NotImplemented'
 */

/**
 * @openapi
 * /v1/orders/{order_id}/acknowledge:
 *   post:
 *     summary: Acknowledge receipt of an order
 *     parameters:
 *       - in: header
 *         name: Kasbah-Key
 *         schema: { type: string }
 *         required: true
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *       - in: path
 *         name: order_id
 *         schema: { type: string }
 *         required: true
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               acknowledged_at: { type: string, format: date-time }
 *               contact: { type: string }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Acknowledged
 *       404:
 *         description: Order not found
 */

/**
 * @openapi
 * /v1/orders/{order_id}/fulfill:
 *   post:
 *     summary: Mark items as fulfilled for an order
 *     parameters:
 *       - in: header
 *         name: Kasbah-Key
 *         schema: { type: string }
 *         required: true
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *       - in: path
 *         name: order_id
 *         schema: { type: string }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fulfilled_at: { type: string, format: date-time }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     item_id: { type: string }
 *                     quantity: { type: integer }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Fulfillment recorded
 */

/**
 * @openapi
 * /v1/orders/{order_id}/shipments:
 *   post:
 *     summary: Create a shipment for an order
 *     parameters:
 *       - in: header
 *         name: Kasbah-Key
 *         schema: { type: string }
 *         required: true
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *       - in: path
 *         name: order_id
 *         schema: { type: string }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               carrier: { type: string }
 *               tracking_number: { type: string }
 *               status: { type: string, example: shipped }
 *               shipped_at: { type: string, format: date-time }
 *               estimated_delivery_at: { type: string, format: date-time }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     item_id: { type: string }
 *                     quantity: { type: integer }
 *     responses:
 *       201:
 *         description: Shipment created
 */

/**
 * @openapi
 * /v1/orders/{order_id}/shipments/{shipment_id}/events:
 *   post:
 *     summary: Append an event to a shipment
 *     parameters:
 *       - in: header
 *         name: Kasbah-Key
 *         schema: { type: string }
 *         required: true
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *       - in: path
 *         name: order_id
 *         schema: { type: string }
 *         required: true
 *       - in: path
 *         name: shipment_id
 *         schema: { type: string }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, example: shipment.in_transit }
 *               status: { type: string, example: in_transit }
 *               message: { type: string }
 *               timestamp: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Event recorded
 */

/**
 * @openapi
 * /v1/suppliers/{supplier_id}/inventory:
 *   post:
 *     summary: Batch upsert of inventory for a supplier
 *     parameters:
 *       - in: header
 *         name: Kasbah-Key
 *         schema: { type: string }
 *         required: true
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *       - in: path
 *         name: supplier_id
 *         schema: { type: string }
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     sku: { type: string }
 *                     available: { type: boolean }
 *                     quantity: { type: integer }
 *                     status: { type: string }
 *                     updated_at: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Upsert results per SKU
 */
