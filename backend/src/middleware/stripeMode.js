const { assertModeAvailable, normalizeMode } = require('../services/stripeMode');

function resolveStripeMode(req) {
  const header = req.headers['x-stripe-mode'];
  return normalizeMode(typeof header === 'string' ? header : 'test');
}

function requireStripeMode(req, _res, next) {
  try {
    req.stripeMode = assertModeAvailable(resolveStripeMode(req));
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { resolveStripeMode, requireStripeMode };
