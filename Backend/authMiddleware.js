import './loadEnv.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'defaultsecret';

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (value === 'manager') return 'farm_manager';
  if (value === 'superadmin') return 'super_admin';
  if (value === 'farmer') return 'worker';
  return value;
}

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
    if (payload.userId === undefined || payload.userId === null || payload.userId === '') {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.user = {
      userId: payload.userId,
      role: normalizeRole(payload.role),
    };
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
    const normalizedRoles = roles.map(normalizeRole);
    if (!req.user || !normalizedRoles.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}
