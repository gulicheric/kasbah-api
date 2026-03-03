const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let db = null;

function initializeFirestore() {
  if (db) return db;
  
  try {
    let credential;
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const serviceAccountKey = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
      };
      credential = admin.credential.cert(serviceAccountKey);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = admin.credential.applicationDefault();
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential,
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
    
    db = admin.firestore();
    console.log('✅ Real Firestore initialized successfully');
    return db;
    
  } catch (error) {
    console.error('❌ Failed to initialize real Firestore:', error);
    // Do not fall back to mock data; callers must handle unavailable DB
    return null;
  }
}

/**
 * Real Orders Service - handles Firestore operations with actual data
 */
class RealOrdersService {
  constructor() {
    this.db = initializeFirestore();
  }

  // Safe ISO conversion for Firestore Timestamp or date-like values
  _toIsoMaybe(val) {
    try {
      if (!val) return undefined;
      if (typeof val?.toDate === 'function') {
        const d = val.toDate();
        return typeof d?.toISOString === 'function' ? d.toISOString() : undefined;
      }
      if (val instanceof Date) {
        return val.toISOString();
      }
      if (typeof val === 'number') {
        // Treat as epoch ms if looks like ms, else seconds
        const ms = val > 1e12 ? val : val * 1000;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? undefined : d.toISOString();
      }
      if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d.toISOString();
      }
      return undefined;
    } catch (_) {
      return undefined;
    }
  }

  _asString(val) {
    if (val == null) return undefined;
    try { return typeof val === 'string' ? val : String(val); } catch (_) { return undefined; }
  }

  // Utilities
  _ts(dateStr) {
    return dateStr ? new Date(dateStr) : new Date();
  }

  async _ensureOrder(orderId) {
    const snap = await this.db.collection('orders').doc(orderId).get();
    return snap.exists;
  }
  
  /**
   * Get orders by supplier ID from supplierOrders field
   */
  async getOrdersBySupplierId(supplierId, filters = {}, pagination = {}) {
    try {
      if (!this.db) {
        throw new Error('Firestore is not initialized');
      }
      
      let query = this.db.collection('orders');
      
      // Use denormalized supplierIds for efficient lookup
      query = query.where('supplierIds', 'array-contains', supplierId);
      
      // Optional top-level status filter (overall order status)
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      
      // Apply additional filters
      if (filters.status) {
        // Check status in the supplier-specific order
        query = query.where(`supplierOrders.${supplierId}.status`, '==', filters.status);
      }
      
      if (filters.created_at_gte) {
        query = query.where('createdAt', '>=', new Date(filters.created_at_gte));
      }
      
      if (filters.created_at_lte) {
        query = query.where('createdAt', '<=', new Date(filters.created_at_lte));
      }
      
      // Apply sorting
      const sortField = pagination.sort?.replace('-', '') || 'createdAt';
      const sortDirection = pagination.sort?.startsWith('-') ? 'desc' : 'desc';
      const orderField = (sortField === 'createdAt' || sortField === 'updatedAt') ? sortField : 'createdAt';
      query = query.orderBy(orderField, sortDirection).orderBy('__name__');

      // Pagination via cursor
      if (pagination.cursor) {
        const c = this.decodeCursor(pagination.cursor);
        if (c?.created_at && c?.id) {
          query = query.startAfter(new Date(c.created_at), this.db.collection('orders').doc(c.id));
        }
      }
      
      // Apply limit
      const limit = Math.min(parseInt(pagination.limit) || 50, 200);
      query = query.limit(limit + 1); // +1 to check if there are more results
      
      const snapshot = await query.get();
      const orders = [];
      let hasMore = false;
      
      snapshot.docs.forEach((doc, index) => {
        if (index < limit) {
          const formatted = this.formatOrderForSupplier(doc, supplierId);
          if (formatted) orders.push(formatted);
        } else {
          hasMore = true;
        }
      });
      
      // Generate next cursor if needed
      let nextCursor = null;
      if (hasMore && orders.length > 0) {
        const lastOrder = orders[orders.length - 1];
        nextCursor = this.encodeCursor(lastOrder);
      }
      
      return {
        data: orders,
        pagination: {
          limit,
          has_more: hasMore,
          next_cursor: nextCursor
        }
      };
      
    } catch (error) {
      console.error(`Error getting orders for supplier ${supplierId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get orders by buyer/customer ID
   */
  async getOrdersByBuyerId(buyerId, filters = {}, pagination = {}) {
    try {
      if (!this.db) {
        throw new Error('Firestore is not initialized');
      }
      
      let query = this.db.collection('orders');
      
      // Filter by customer/buyer ID
      query = query.where('customerId', '==', buyerId);
      
      // Apply additional filters
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      
      if (filters.created_at_gte) {
        query = query.where('createdAt', '>=', new Date(filters.created_at_gte));
      }
      
      if (filters.created_at_lte) {
        query = query.where('createdAt', '<=', new Date(filters.created_at_lte));
      }
      
      // Apply sorting
      const sortField = pagination.sort?.replace('-', '') || 'createdAt';
      const sortDirection = pagination.sort?.startsWith('-') ? 'desc' : 'desc';
      query = query.orderBy('createdAt', sortDirection).orderBy('__name__');

      if (pagination.cursor) {
        const c = this.decodeCursor(pagination.cursor);
        if (c?.created_at && c?.id) {
          query = query.startAfter(new Date(c.created_at), this.db.collection('orders').doc(c.id));
        }
      }
      
      // Apply limit
      const limit = Math.min(parseInt(pagination.limit) || 50, 200);
      query = query.limit(limit + 1);
      
      const snapshot = await query.get();
      const orders = [];
      let hasMore = false;
      
      snapshot.docs.forEach((doc, index) => {
        if (index < limit) {
          orders.push(this.formatOrderForBuyer(doc));
        } else {
          hasMore = true;
        }
      });
      
      // Generate next cursor if needed
      let nextCursor = null;
      if (hasMore && orders.length > 0) {
        const lastOrder = orders[orders.length - 1];
        nextCursor = this.encodeCursor(lastOrder);
      }
      
      return {
        data: orders,
        pagination: {
          limit,
          has_more: hasMore,
          next_cursor: nextCursor
        }
      };
      
    } catch (error) {
      console.error(`Error getting orders for buyer ${buyerId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get single order by ID
   */
  async getOrder(orderId) {
    try {
      if (!this.db) {
        throw new Error('Firestore is not initialized');
      }
      
      const doc = await this.db.collection('orders').doc(orderId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return this.formatOrderComplete(doc);
      
    } catch (error) {
      console.error(`Error getting order ${orderId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get user information by ID
   */
  async getUser(userId) {
    try {
      if (!this.db) {
        throw new Error('Firestore is not initialized');
      }
      
      const doc = await this.db.collection('users').doc(userId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return this.formatUser(doc);
      
    } catch (error) {
      console.error(`Error getting user ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get products/inventory with pagination (limit 20)
   */
  async getProducts(filters = {}, pagination = {}) {
    try {
      if (!this.db) {
        throw new Error('Firestore is not initialized');
      }
      
      let query = this.db.collection('products');
      
      // Apply filters
      if (filters.supplier_id) {
        query = query.where('supplierId', '==', filters.supplier_id);
      }
      
      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }
      
      if (filters.name) {
        // For name search, we'll use array-contains-any if possible
        // or implement client-side filtering for partial matches
        query = query.where('name', '>=', filters.name)
                     .where('name', '<', filters.name + '\uf8ff');
      }
      
      // Apply sorting and pagination cursor
      const sortField = pagination.sort?.replace('-', '') || 'updatedAt';
      const sortDirection = pagination.sort?.startsWith('-') ? 'desc' : 'desc';
      const orderField = (sortField === 'createdAt' || sortField === 'updatedAt') ? sortField : 'updatedAt';
      query = query.orderBy(orderField, sortDirection).orderBy('__name__');

      if (pagination.cursor) {
        const c = this.decodeCursor(pagination.cursor);
        if (c?.created_at && c?.id) {
          query = query.startAfter(new Date(c.created_at), this.db.collection('products').doc(c.id));
        }
      }
      
      // Strict limit of 20 for products
      const limit = Math.min(parseInt(pagination.limit) || 20, 20);
      query = query.limit(limit + 1);
      
      const snapshot = await query.get();
      const products = [];
      let hasMore = false;
      
      snapshot.docs.forEach((doc, index) => {
        if (index < limit) {
          products.push(this.formatProduct(doc));
        } else {
          hasMore = true;
        }
      });
      
      // Generate next cursor if needed
      let nextCursor = null;
      if (hasMore && products.length > 0) {
        const lastProduct = products[products.length - 1];
        nextCursor = this.encodeCursor(lastProduct);
      }
      
      return {
        data: products,
        pagination: {
          limit,
          has_more: hasMore,
          next_cursor: nextCursor
        }
      };
      
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  /**
   * Write APIs (acknowledge, fulfill, shipments, inventory)
   */
  async acknowledgeOrder(orderId, payload = {}, actor = {}) {
    if (!this.db) throw new Error('Firestore is not initialized');
    const exists = await this._ensureOrder(orderId);
    if (!exists) return { not_found: true };
    const evt = {
      type: 'order.acknowledged',
      timestamp: new Date(),
      acknowledged_at: this._ts(payload.acknowledged_at),
      contact: payload.contact || null,
      actor,
      notes: payload.notes || null
    };
    await this.db.collection('orders').doc(orderId).collection('events').add(evt);
    return { success: true, event: evt };
  }

  async fulfillOrder(orderId, payload = {}, actor = {}) {
    if (!this.db) throw new Error('Firestore is not initialized');
    const exists = await this._ensureOrder(orderId);
    if (!exists) return { not_found: true };
    const evt = {
      type: 'order.fulfilled',
      timestamp: new Date(),
      fulfilled_at: this._ts(payload.fulfilled_at),
      items: Array.isArray(payload.items) ? payload.items : [],
      notes: payload.notes || null,
      actor
    };
    await this.db.collection('orders').doc(orderId).collection('events').add(evt);
    return { success: true, event: evt };
  }

  async createShipment(orderId, payload = {}, actor = {}) {
    if (!this.db) throw new Error('Firestore is not initialized');
    const orderRef = this.db.collection('orders').doc(orderId);
    const exists = (await orderRef.get()).exists;
    if (!exists) return { not_found: true };

    const ship = {
      carrier: payload.carrier,
      tracking_number: payload.tracking_number,
      status: payload.status || 'shipped',
      items: Array.isArray(payload.items) ? payload.items : [],
      shipped_at: this._ts(payload.shipped_at),
      estimated_delivery_at: payload.estimated_delivery_at ? new Date(payload.estimated_delivery_at) : null,
      created_at: new Date(),
      actor
    };
    const ref = await orderRef.collection('shipments').add(ship);

    const evt = { type: 'shipment.created', timestamp: new Date(), shipment_id: ref.id, tracking_number: ship.tracking_number, actor };
    await orderRef.collection('events').add(evt);

    return { success: true, shipment_id: ref.id, shipment: ship };
  }

  async addShipmentEvent(orderId, shipmentId, payload = {}, actor = {}) {
    if (!this.db) throw new Error('Firestore is not initialized');
    const orderRef = this.db.collection('orders').doc(orderId);
    const shipRef = orderRef.collection('shipments').doc(shipmentId);
    const exists = (await shipRef.get()).exists;
    if (!exists) return { not_found: true };

    const evt = {
      type: payload.type || 'shipment.updated',
      status: payload.status,
      message: payload.message || null,
      timestamp: this._ts(payload.timestamp),
      actor
    };
    await shipRef.collection('events').add(evt);
    await orderRef.collection('events').add({ ...evt, shipment_id: shipmentId });
    return { success: true, event: evt };
  }

  async upsertInventory(supplierId, items = [], actor = {}) {
    if (!this.db) throw new Error('Firestore is not initialized');
    const results = [];
    for (const it of items) {
      const sku = it.sku;
      if (!sku) { results.push({ sku: null, updated: false, reason: 'missing_sku' }); continue; }
      const q = await this.db.collection('products').where('supplierId', '==', supplierId).where('sku', '==', sku).limit(1).get();
      if (q.empty) {
        results.push({ sku, updated: false, reason: 'not_found' });
        continue;
      }
      const doc = q.docs[0];
      const update = {
        inventory: {
          available: typeof it.available === 'boolean' ? it.available : true,
          quantity: typeof it.quantity === 'number' ? it.quantity : 0,
          status: it.status || 'active'
        },
        updatedAt: new Date()
      };
      await doc.ref.update(update);
      results.push({ sku, updated: true });
    }
    return { success: true, results };
  }
  
  /**
   * Format order for supplier view (showing their specific supplier order)
   */
  formatOrderForSupplier(doc, supplierId) {
    const data = doc.data();
    const supplierOrder = data.supplierOrders?.[supplierId];
    
    if (!supplierOrder) {
      return null;
    }
    
    return {
      id: doc.id,
      order_number: data.orderNumber || `ORD-${doc.id.slice(-6)}`,
      created_at: data.createdAt?.toDate()?.toISOString(),
      updated_at: data.updatedAt?.toDate()?.toISOString(),
      status: supplierOrder.status || 'pending',
      customer: {
        id: data.customerId,
        name: data.customerName,
        email: data.customerEmail
      },
      supplier: {
        id: supplierId,
        name: supplierOrder.supplierName,
        email: supplierOrder.supplierEmail
      },
      totals: {
        subtotal: supplierOrder.subtotal || 0,
        currency: 'USD'
      },
      items: supplierOrder.items?.map(item => ({
        item_id: item.cartItemId || item.id,
        product_id: item.id,
        sku: item.supplierInfo?.sku || item.sku,
        name: item.name,
        quantity: item.quantity,
        uom: item.supplierInfo?.uom || item.uom,
        unit_price: item.price,
        extended_price: item.quantity * item.price,
        category: item.supplierInfo?.category
      })) || [],
      metadata: {
        source: 'kasbah',
        supplier_id: supplierId,
        total_suppliers: data.numberOfSuppliers,
        total_items: data.numberOfItems
      }
    };
  }
  
  /**
   * Format order for buyer view (showing complete order)
   */
  formatOrderForBuyer(doc) {
    const data = doc.data();
    
    return {
      id: doc.id,
      order_number: data.orderNumber || `ORD-${doc.id.slice(-6)}`,
      created_at: data.createdAt?.toDate()?.toISOString(),
      updated_at: data.updatedAt?.toDate()?.toISOString(),
      status: data.status || 'pending',
      customer: {
        id: data.customerId,
        name: data.customerName,
        email: data.customerEmail
      },
      totals: {
        grand_total: data.totalAmount || 0,
        currency: 'USD'
      },
      suppliers: Object.entries(data.supplierOrders || {}).map(([supplierId, supplierOrder]) => ({
        supplier_id: supplierId,
        supplier_name: supplierOrder.supplierName,
        status: supplierOrder.status,
        subtotal: supplierOrder.subtotal,
        items_count: supplierOrder.items?.length || 0
      })),
      summary: {
        total_suppliers: data.numberOfSuppliers || 0,
        total_items: data.numberOfItems || 0,
        assigned_to: data.assignedTo,
        assigned_at: data.assignedAt?.toDate()?.toISOString()
      },
      metadata: {
        source: 'kasbah',
        buyer_id: data.customerId
      }
    };
  }
  
  /**
   * Format complete order (for single order view)
   */
  formatOrderComplete(doc) {
    const data = doc.data();
    
    return {
      id: doc.id,
      order_number: data.orderNumber || `ORD-${doc.id.slice(-6)}`,
      created_at: data.createdAt?.toDate()?.toISOString(),
      updated_at: data.updatedAt?.toDate()?.toISOString(),
      status: data.status || 'pending',
      customer: {
        id: data.customerId,
        name: data.customerName,
        email: data.customerEmail
      },
      totals: {
        grand_total: data.totalAmount || 0,
        currency: 'USD'
      },
      suppliers: Object.entries(data.supplierOrders || {}).map(([supplierId, supplierOrder]) => ({
        supplier_id: supplierId,
        supplier_name: supplierOrder.supplierName,
        supplier_email: supplierOrder.supplierEmail,
        status: supplierOrder.status,
        subtotal: supplierOrder.subtotal,
        items: supplierOrder.items?.map(item => ({
          item_id: item.cartItemId || item.id,
          product_id: item.id,
          sku: item.supplierInfo?.sku || item.sku,
          name: item.name,
          quantity: item.quantity,
          uom: item.supplierInfo?.uom || item.uom,
          unit_price: item.price,
          extended_price: item.quantity * item.price,
          category: item.supplierInfo?.category
        })) || []
      })),
      original_cart: data.originalCartItems?.map(item => ({
        item_id: item.cartItemId || item.id,
        product_id: item.id,
        name: item.name,
        quantity: item.quantity,
        uom: item.uom,
        unit_price: item.price
      })) || [],
      metadata: {
        source: 'kasbah',
        total_suppliers: data.numberOfSuppliers || 0,
        total_items: data.numberOfItems || 0,
        assigned_to: data.assignedTo,
        assigned_at: data.assignedAt?.toDate()?.toISOString()
      }
    };
  }
  
  /**
   * Format user data
   */
  formatUser(doc) {
    try {
      const data = doc.data() || {};

      const out = {
        id: doc.id,
        email: this._asString(data.email),
        name: this._asString(data.name) || this._asString(data.displayName),
        role: this._asString(data.role) || 'user',
        company: {
          name: this._asString(data.companyName),
          type: this._asString(data.companyType)
        },
        created_at: this._toIsoMaybe(data.createdAt),
        updated_at: this._toIsoMaybe(data.updatedAt),
        profile: {
          phone: this._asString(data.phone),
          address: this._asString(data.address),
          timezone: this._asString(data.timezone)
        },
        metadata: {
          source: 'kasbah',
          last_login: this._toIsoMaybe(data.lastLogin),
          email_verified: Boolean(data.emailVerified)
        }
      };

      return out;
    } catch (err) {
      // Log detailed context and return a minimal safe payload
      console.error('formatUser error', {
        user_id: doc?.id,
        error: { message: err?.message, stack: err?.stack }
      });
      return { id: doc?.id, metadata: { source: 'kasbah' } };
    }
  }
  
  /**
   * Format product data
   */
  formatProduct(doc) {
    const data = doc.data();
    
    return {
      id: doc.id,
      sku: data.sku,
      name: data.name,
      description: data.description,
      category: data.category,
      price: data.price || 0,
      uom: data.uom || 'each',
      supplier: {
        id: data.supplierId,
        name: data.supplierName
      },
      inventory: {
        available: data.available || false,
        quantity: data.quantity || 0,
        status: data.status || 'active'
      },
      details: {
        manufacturer: data.manufacturer,
        brand: data.brand,
        model: data.model,
        variants: data.variants
      },
      created_at: data.createdAt?.toDate()?.toISOString(),
      updated_at: data.updatedAt?.toDate()?.toISOString(),
      metadata: {
        source: 'kasbah',
        supplier_id: data.supplierId
      }
    };
  }
  
  /**
   * Encode cursor for pagination
   */
  encodeCursor(item) {
    const cursorData = {
      created_at: item.created_at,
      id: item.id
    };
    
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }
  
  decodeCursor(token) {
    try {
      return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Mock data methods for fallback
   */
}

module.exports = {
  initializeFirestore,
  RealOrdersService
};
