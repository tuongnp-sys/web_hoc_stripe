const { config } = require('../config');
const { requireAuth } = require('./auth');

function isAdminUser(user) {
  return user?.role === 'admin';
}

function requireAdminSecret(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (config.adminSecret && secret === config.adminSecret) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
}

function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (config.adminSecret && secret === config.adminSecret) {
    return next();
  }
  if (req.user && isAdminUser(req.user)) {
    return next();
  }
  if (config.nodeEnv === 'development' && req.user && isAdminUser(req.user)) {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

function requireAdminAuth(req, res, next) {
  requireAuth(req, res, () => {
    if (res.headersSent) return;
    requireAdmin(req, res, next);
  });
}

module.exports = {
  isAdminUser,
  requireAdmin,
  requireAdminAuth,
  requireAdminSecret,
};
