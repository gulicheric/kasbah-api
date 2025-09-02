const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let db = null;

function initializeFirestore() {
  if (db) return db;
  
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
    console.log('✅ Real Firestore initialized successfully');
    return db;
    
  } catch (error) {
    console.error('❌ Failed to initialize real Firestore:', error);
    console.warn('⚠️  Falling back to demo mode with mock data.');
    return null; // Fall back to mock data
  }
}

/**
 * Real Orders Service - handles Firestore operations with actual data
 */
class RealOrdersService {
  constructor() {
    this.db = initializeFirestore();
  }
  
  /**
   * Get orders by supplier ID from supplierOrders field
   */
  async getOrdersBySupplierId(supplierId, filters = {}, pagination = {}) {
    try {
      if (!this.db) {
        return this.getMockOrdersBySupplierId(supplierId, filters, pagination);
      }
      
      let query = this.db.collection('orders');
      
      // Filter by supplier ID - orders contain supplierOrders object with supplier IDs as keys
      query = query.where(`supplierOrders.${supplierId}`, '!=', null);
      
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
      const sortDirection = pagination.sort?.startsWith('-') ? 'desc' : 'asc';
      query = query.orderBy(sortField, sortDirection);
      
      // Apply limit
      const limit = Math.min(parseInt(pagination.limit) || 50, 200);
      query = query.limit(limit + 1); // +1 to check if there are more results
      
      const snapshot = await query.get();
      const orders = [];
      let hasMore = false;
      
      snapshot.docs.forEach((doc, index) => {
        if (index < limit) {
          orders.push(this.formatOrderForSupplier(doc, supplierId));
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
        return this.getMockOrdersByBuyerId(buyerId, filters, pagination);
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
      const sortDirection = pagination.sort?.startsWith('-') ? 'desc' : 'asc';
      query = query.orderBy(sortField, sortDirection);
      
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
        return this.getMockOrder(orderId);
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
        return this.getMockUser(userId);
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
        return this.getMockProducts(filters, pagination);
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
      
      // Apply sorting
      const sortField = pagination.sort?.replace('-', '') || 'updatedAt';
      const sortDirection = pagination.sort?.startsWith('-') ? 'desc' : 'asc';
      
      // Only apply ordering if we have the field
      if (sortField === 'updatedAt' || sortField === 'createdAt') {
        query = query.orderBy(sortField, sortDirection);
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
   * Format order for supplier view (showing their specific supplier order)
   */
  formatOrderForSupplier(doc, supplierId) {
    const data = doc.to_dict();
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
    const data = doc.to_dict();
    
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
    const data = doc.to_dict();
    
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
    const data = doc.to_dict();
    
    return {
      id: doc.id,
      email: data.email,
      name: data.name || data.displayName,
      role: data.role || 'user',
      company: {
        name: data.companyName,
        type: data.companyType
      },
      created_at: data.createdAt?.toDate()?.toISOString(),
      updated_at: data.updatedAt?.toDate()?.toISOString(),
      profile: {
        phone: data.phone,
        address: data.address,
        timezone: data.timezone
      },
      metadata: {
        source: 'kasbah',
        last_login: data.lastLogin?.toDate()?.toISOString(),
        email_verified: data.emailVerified || false
      }
    };
  }
  
  /**
   * Format product data
   */
  formatProduct(doc) {
    const data = doc.to_dict();
    
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
  
  /**
   * Mock data methods for fallback
   */
  getMockOrdersBySupplierId(supplierId) {
    return {
      orders: [{
        id: 'mock_order_1',
        order_number: 'ORD-MOCK-001',
        status: 'pending',
        supplier: { id: supplierId, name: 'Mock Supplier' },
        customer: { id: 'buyer_1', name: 'Mock Buyer' },
        totals: { subtotal: 100.00, currency: 'USD' },
        items: [],
        metadata: { source: 'kasbah_mock' }
      }],
      limit: 50,
      hasMore: false,
      nextCursor: null
    };
  }
  
  getMockOrdersByBuyerId(buyerId) {
    return {
      orders: [{
        id: 'mock_order_1',
        order_number: 'ORD-MOCK-001',
        status: 'pending',
        customer: { id: buyerId, name: 'Mock Buyer' },
        totals: { grand_total: 100.00, currency: 'USD' },
        suppliers: [],
        metadata: { source: 'kasbah_mock' }
      }],
      limit: 50,
      hasMore: false,
      nextCursor: null
    };
  }
  
  getMockOrder(orderId) {
    return {
      id: orderId,
      order_number: 'ORD-MOCK-001',
      status: 'pending',
      customer: { id: 'buyer_1', name: 'Mock Buyer' },
      totals: { grand_total: 100.00, currency: 'USD' },
      suppliers: [],
      metadata: { source: 'kasbah_mock' }
    };
  }
  
  getMockUser(userId) {
    return {
      id: userId,
      email: 'mock@example.com',
      name: 'Mock User',
      role: 'user',
      company: { name: 'Mock Company' },
      metadata: { source: 'kasbah_mock' }
    };
  }
  
  getMockProducts() {
    return {
      products: [{
        id: 'mock_product_1',
        sku: 'MOCK-001',
        name: 'Mock Product',
        category: 'test',
        price: 10.00,
        uom: 'each',
        supplier: { id: 'supplier_1', name: 'Mock Supplier' },
        metadata: { source: 'kasbah_mock' }
      }],
      limit: 20,
      hasMore: false,
      nextCursor: null
    };
  }
}

module.exports = {
  initializeFirestore,
  RealOrdersService
};