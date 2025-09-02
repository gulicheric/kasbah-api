const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let db = null;

function initializeFirestore() {
  if (db) return db;
  
  // Check if Firebase credentials are available
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.warn('⚠️  Firebase credentials not found. Running in demo mode with mock data.');
    return null; // Return null to use mock data
  }
  
  try {
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
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
    
    db = admin.firestore();
    console.log('✅ Firestore initialized successfully');
    return db;
    
  } catch (error) {
    console.error('❌ Failed to initialize Firestore:', error);
    console.warn('⚠️  Falling back to demo mode with mock data.');
    return null; // Fall back to mock data
  }
}

/**
 * Orders Service - handles all order-related Firestore operations
 */
class OrdersService {
  constructor() {
    this.db = initializeFirestore();
  }
  
  /**
   * List orders with filtering and pagination
   */
  async listOrders(filters = {}, pagination = {}) {
    try {
      // Use mock data if Firestore is not available
      if (!this.db) {
        return this.getMockOrders(filters, pagination);
      }
      
      let query = this.db.collection('orders');
      
      // Apply filters
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      
      if (filters.customer_id) {
        query = query.where('customerId', '==', filters.customer_id);
      }
      
      if (filters.supplier_id) {
        query = query.where('supplierId', '==', filters.supplier_id);
      }
      
      if (filters.created_at_gte) {
        query = query.where('createdAt', '>=', new Date(filters.created_at_gte));
      }
      
      if (filters.created_at_lte) {
        query = query.where('createdAt', '<=', new Date(filters.created_at_lte));
      }
      
      if (filters.updated_at_gte) {
        query = query.where('updatedAt', '>=', new Date(filters.updated_at_gte));
      }
      
      if (filters.updated_at_lte) {
        query = query.where('updatedAt', '<=', new Date(filters.updated_at_lte));
      }
      
      // Apply sorting (default: newest first)
      const sortField = pagination.sort?.replace('-', '') || 'createdAt';
      const sortDirection = pagination.sort?.startsWith('-') ? 'desc' : 'asc';
      query = query.orderBy(sortField, sortDirection);
      
      // Add secondary sort by ID for stable cursor pagination
      if (sortField !== 'id') {
        query = query.orderBy('id', sortDirection);
      }
      
      // Apply cursor pagination
      if (pagination.cursor) {
        const cursorDoc = await this.decodeCursor(pagination.cursor);
        query = query.startAfter(cursorDoc);
      }
      
      // Apply limit
      const limit = Math.min(parseInt(pagination.limit) || 50, 200);
      query = query.limit(limit + 1); // +1 to check if there are more results
      
      const snapshot = await query.get();
      const orders = [];
      let hasMore = false;
      
      snapshot.docs.forEach((doc, index) => {
        if (index < limit) {
          orders.push(this.formatOrder(doc));
        } else {
          hasMore = true; // We have more results
        }
      });
      
      // Generate next cursor if there are more results
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
      console.error('Error listing orders:', error);
      throw error;
    }
  }
  
  /**
   * Get a single order by ID
   */
  async getOrder(orderId) {
    try {
      // Use mock data if Firestore is not available
      if (!this.db) {
        return this.getMockOrder(orderId);
      }
      
      const doc = await this.db.collection('orders').doc(orderId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return this.formatOrder(doc);
      
    } catch (error) {
      console.error(`Error getting order ${orderId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get order items (line items)
   */
  async getOrderItems(orderId) {
    try {
      // Use mock data if Firestore is not available
      if (!this.db) {
        return this.getMockOrderItems(orderId);
      }
      
      const snapshot = await this.db
        .collection('orders')
        .doc(orderId)
        .collection('items')
        .orderBy('createdAt')
        .get();
      
      return snapshot.docs.map(doc => this.formatOrderItem(doc));
      
    } catch (error) {
      console.error(`Error getting items for order ${orderId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get order events/history
   */
  async getOrderEvents(orderId) {
    try {
      // Use mock data if Firestore is not available
      if (!this.db) {
        return this.getMockOrderEvents(orderId);
      }
      
      const snapshot = await this.db
        .collection('events')
        .where('orderId', '==', orderId)
        .orderBy('timestamp', 'desc')
        .get();
      
      return snapshot.docs.map(doc => this.formatOrderEvent(doc));
      
    } catch (error) {
      console.error(`Error getting events for order ${orderId}:`, error);
      throw error;
    }
  }
  
  /**
   * Format order document for API response
   */
  formatOrder(doc) {
    const data = doc.data();
    
    return {
      id: doc.id,
      number: data.orderNumber || `KSB-${doc.id.slice(-6)}`,
      created_at: data.createdAt?.toDate()?.toISOString(),
      updated_at: data.updatedAt?.toDate()?.toISOString(),
      status: data.status || 'PENDING',
      customer: {
        id: data.customerId,
        name: data.customerName || data.customer?.name
      },
      totals: {
        subtotal: data.subtotal || 0,
        shipping: data.shippingCost || 0,
        tax: data.taxAmount || 0,
        discount: data.discountAmount || 0,
        grand_total: data.grandTotal || data.total || 0,
        currency: data.currency || 'USD'
      },
      shipping: {
        method: data.shippingMethod,
        address: data.shippingAddress,
        tracking: data.trackingInfo || []
      },
      metadata: {
        source: 'kasbah',
        supplier_id: data.supplierId,
        external_id: data.externalId,
        ...data.metadata
      }
    };
  }
  
  /**
   * Format order item for API response
   */
  formatOrderItem(doc) {
    const data = doc.data();
    
    return {
      item_id: doc.id,
      sku: data.sku,
      name: data.name || data.productName,
      quantity: data.quantity,
      uom: data.unitOfMeasure || 'each',
      unit_price: data.unitPrice,
      extended_price: data.extendedPrice || (data.unitPrice * data.quantity),
      metadata: data.metadata || {}
    };
  }
  
  /**
   * Format order event for API response
   */
  formatOrderEvent(doc) {
    const data = doc.data();
    
    return {
      id: doc.id,
      type: data.eventType,
      status: data.status,
      timestamp: data.timestamp?.toDate()?.toISOString(),
      message: data.message,
      metadata: data.metadata || {}
    };
  }
  
  /**
   * Encode cursor for pagination
   */
  encodeCursor(order) {
    const cursorData = {
      created_at: order.created_at,
      id: order.id
    };
    
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }
  
  /**
   * Decode cursor for pagination
   */
  async decodeCursor(cursor) {
    try {
      const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      
      // Return the document snapshot for cursor pagination
      const doc = await this.db.collection('orders').doc(cursorData.id).get();
      return doc;
      
    } catch (error) {
      throw new Error('Invalid cursor format');
    }
  }
  
  /**
   * Mock data methods for testing without Firestore
   */
  getMockOrders(filters = {}, pagination = {}) {
    const mockOrders = [
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
    
    // Apply status filter
    let filteredOrders = mockOrders;
    if (filters.status) {
      filteredOrders = filteredOrders.filter(order => order.status === filters.status);
    }
    
    // Apply customer_id filter
    if (filters.customer_id) {
      filteredOrders = filteredOrders.filter(order => order.customer.id === filters.customer_id);
    }
    
    // Apply pagination
    const limit = Math.min(parseInt(pagination.limit) || 50, 200);
    const startIndex = pagination.cursor ? 1 : 0; // Simple cursor simulation
    const endIndex = startIndex + limit;
    
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);
    const hasMore = endIndex < filteredOrders.length;
    
    return {
      data: paginatedOrders,
      pagination: {
        limit,
        has_more: hasMore,
        next_cursor: hasMore ? this.encodeCursor(paginatedOrders[paginatedOrders.length - 1]) : null
      }
    };
  }
  
  getMockOrder(orderId) {
    const mockOrders = this.getMockOrders().data;
    return mockOrders.find(order => order.id === orderId) || null;
  }
  
  getMockOrderItems(orderId) {
    const order = this.getMockOrder(orderId);
    if (!order) return [];
    
    return [
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
    ];
  }
  
  getMockOrderEvents(orderId) {
    const order = this.getMockOrder(orderId);
    if (!order) return [];
    
    return [
      {
        id: 'evt_abc123',
        type: 'order.created',
        status: 'PENDING',
        timestamp: order.created_at,
        message: 'Order created and awaiting approval',
        metadata: {}
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
        id: 'evt_ghi789',
        type: 'order.fulfilled',
        status: 'FULFILLED',
        timestamp: order.updated_at,
        message: 'Order fulfilled and shipped',
        metadata: { tracking_number: '1Z999AA1234567890' }
      }
    ];
  }
}

/**
 * Shipments Service
 */
class ShipmentsService {
  constructor() {
    this.db = initializeFirestore();
  }
  
  async listShipments(filters = {}, pagination = {}) {
    // Implementation similar to orders
    // Will implement in next phase
    return { data: [], pagination: { has_more: false } };
  }
  
  async getShipment(shipmentId) {
    // Implementation for single shipment
    return null;
  }
}

module.exports = {
  initializeFirestore,
  OrdersService,
  ShipmentsService
};