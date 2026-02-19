const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || String(secret).trim().length < 16) {
      throw new Error('JWT_SECRET must be set and at least 16 characters in production');
    }
    return secret;
  }
  return secret && String(secret).trim() ? secret : 'dev-jwt-secret-change-me';
}

const JWT_SECRET = getJwtSecret();

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    console.error('JWT verify failed', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  const access = req.user && req.user.access;
  // Treat missing access (old tokens or legacy rows) as full access
  if (access === 'admin' || access === 'both' || access == null) return next();
  return res.status(403).json({ error: 'Admin access required' });
}

function requireScanner(req, res, next) {
  const access = req.user && req.user.access;
  if (access === 'scanner' || access === 'both' || access == null) return next();
  return res.status(403).json({ error: 'Scanner access required' });
}

module.exports = {
  authMiddleware,
  requireAdmin,
  requireScanner,
};

