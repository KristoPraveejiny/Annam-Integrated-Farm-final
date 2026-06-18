import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'defaultsecret';

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  // Support both "Bearer <token>" and raw token formats
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    token = authHeader;
  }
  // Remove possible Python byte literal wrapper (e.g., "b'...'")
  if (token.startsWith("b'") && token.endsWith("'")) {
    token = token.slice(2, -1);
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Validate that userId is a proper UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.userId)) {
      console.warn('Invalid UUID in token payload:', payload.userId);
      return res.status(401).json({ error: 'Invalid token payload (malformed userId)' });
    }

    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch (err) {
    console.error('JWT verification failed – token prefix:', token?.slice(0, 20) + '…', 'error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorizeRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}
