const { config } = require('../config');

function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  const isDev = config.nodeEnv === 'development';

  if (isDev || (config.adminSecret && secret === config.adminSecret)) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
}

module.exports = { requireAdmin };
