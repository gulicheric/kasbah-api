const crypto = require('crypto');

class AuthError extends Error {
  constructor(message, type = 'unauthorized') {
    super(message);
    this.type = type;
  }
}

/**
 * HMAC Authentication Middleware
 * 
 * Validates API key and HMAC signature according to spec:
 * - Header: Kasbah-Key: pk_live_xxx
 * - Header: Kasbah-Signature: t=<unix>,s=<hex>
 * - Signature: HMAC_SHA256(secret, t + "\n" + method + "\n" + path + "\n" + body)
 */
const authenticateRequest = async (req, res, next) => {
  try {
    const apiKey = req.headers['kasbah-key'];
    const signature = req.headers['kasbah-signature'];
    
    if (!apiKey) {
      throw new AuthError('Missing Kasbah-Key header');
    }
    
    if (!signature) {
      throw new AuthError('Missing Kasbah-Signature header');
    }
    
    // Parse signature: t=timestamp,s=signature
    const sigParts = signature.split(',');
    const timestampPart = sigParts.find(part => part.startsWith('t='));
    const signaturePart = sigParts.find(part => part.startsWith('s='));
    
    if (!timestampPart || !signaturePart) {
      throw new AuthError('Invalid signature format. Expected: t=<timestamp>,s=<signature>');
    }
    
    const timestamp = timestampPart.substring(2);
    const providedSignature = signaturePart.substring(2);
    
    // Validate timestamp (prevent replay attacks)
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const clockSkew = Math.abs(currentTime - requestTime);
    
    if (clockSkew > 300) { // 5 minutes
      throw new AuthError('Request timestamp is too old or too far in the future');
    }
    
    // Look up API key and get secret (mock for now)
    const apiKeyData = await getApiKeyData(apiKey);
    if (!apiKeyData) {
      throw new AuthError('Invalid API key');
    }
    
    // Verify HMAC signature
    const rawBody = req.rawBody || '';
    const signaturePayload = `${timestamp}\n${req.method}\n${req.path}\n${rawBody}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', apiKeyData.secret)
      .update(signaturePayload, 'utf8')
      .digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(providedSignature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
      throw new AuthError('Invalid signature');
    }
    
    // Check API key permissions/scopes
    if (!hasRequiredPermissions(apiKeyData, req)) {
      throw new AuthError('Insufficient permissions', 'forbidden');
    }
    
    // Attach partner info to request
    req.partner = {
      id: apiKeyData.partnerId,
      name: apiKeyData.partnerName,
      scopes: apiKeyData.scopes,
      ipAllowlist: apiKeyData.ipAllowlist
    };
    
    next();
    
  } catch (error) {
    if (error instanceof AuthError) {
      next(error);
    } else {
      console.error('Authentication error:', error);
      next(new AuthError('Authentication failed'));
    }
  }
};

/**
 * Middleware to capture raw body for HMAC validation
 */
const captureRawBody = (req, res, next) => {
  let data = '';
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
};

/**
 * Mock API key lookup - replace with actual database/Firebase lookup
 */
async function getApiKeyData(apiKey) {
  // Mock data - in production, this would query Firestore
  const mockKeys = {
    'pk_live_abc123': {
      partnerId: 'partner_1',
      partnerName: 'Acme Medical Supply',
      secret: 'sk_live_secret123',
      scopes: ['orders:read', 'shipments:read'],
      ipAllowlist: [], // empty = allow all IPs
      active: true
    },
    'pk_test_xyz789': {
      partnerId: 'partner_test',
      partnerName: 'Test Partner',
      secret: 'sk_test_secret789',
      scopes: ['orders:read'],
      ipAllowlist: ['127.0.0.1', '::1'],
      active: true
    }
  };
  
  const keyData = mockKeys[apiKey];
  return keyData && keyData.active ? keyData : null;
}

/**
 * Check if API key has required permissions for the request
 */
function hasRequiredPermissions(apiKeyData, req) {
  const path = req.path;
  
  // Map routes to required scopes
  const routeScopes = {
    '/v1/orders': ['orders:read'],
    '/v1/shipments': ['shipments:read'],
    '/v1/returns': ['returns:read'],
    '/v1/webhooks': ['webhooks:write'],
    '/v1/ping': [] // no special permissions needed
  };
  
  // Find required scopes for this route
  let requiredScopes = [];
  for (const [routePrefix, scopes] of Object.entries(routeScopes)) {
    if (path.startsWith(routePrefix)) {
      requiredScopes = scopes;
      break;
    }
  }
  
  // Check if API key has all required scopes
  return requiredScopes.every(scope => apiKeyData.scopes.includes(scope));
}

/**
 * Optional IP allowlist middleware
 */
const checkIpAllowlist = (req, res, next) => {
  if (!req.partner || !req.partner.ipAllowlist || req.partner.ipAllowlist.length === 0) {
    return next(); // No IP restrictions
  }
  
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (!req.partner.ipAllowlist.includes(clientIp)) {
    return next(new AuthError('IP address not allowed', 'forbidden'));
  }
  
  next();
};

module.exports = {
  authenticateRequest,
  captureRawBody,
  checkIpAllowlist,
  AuthError
};