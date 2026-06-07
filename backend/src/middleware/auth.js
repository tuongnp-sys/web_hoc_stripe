const jwt = require('jsonwebtoken');
const { config } = require('../config');
const users = require('../services/users');

function isEmailVerified(user) {
  return Boolean(user?.emailVerified ?? user?.email_verified);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await users.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Account not found' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireVerifiedEmail(req, res, next) {
  if (!isEmailVerified(req.user)) {
    return res.status(403).json({
      error: 'Please verify your email before making purchases',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  next();
}

module.exports = { signToken, requireAuth, requireVerifiedEmail, isEmailVerified };
