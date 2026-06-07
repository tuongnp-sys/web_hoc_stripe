const Stripe = require('stripe');
const { config } = require('../config');

const clients = {};

function getSecretKey(mode) {
  if (mode === 'live') {
    return config.stripeSecretKeyLive || null;
  }
  return config.stripeSecretKey;
}

function getWebhookSecret(mode) {
  if (mode === 'live') {
    return config.stripeWebhookSecretLive || null;
  }
  return config.stripeWebhookSecret;
}

function getStripeClient(mode = 'test') {
  const key = getSecretKey(mode);
  if (!key) {
    throw new Error(`Stripe ${mode} mode is not configured`);
  }
  if (!clients[mode]) {
    clients[mode] = new Stripe(key);
  }
  return clients[mode];
}

function isProductionClientUrl() {
  return config.clientUrl.startsWith('https://') && !config.clientUrl.includes('localhost');
}

function getLiveReadiness() {
  const blockers = [];

  if (!config.stripeSecretKeyLive) {
    blockers.push('missing_STRIPE_SECRET_KEY_LIVE');
  }
  if (!config.stripeWebhookSecretLive) {
    blockers.push('missing_STRIPE_WEBHOOK_SECRET_LIVE');
  }
  if (!isProductionClientUrl()) {
    blockers.push('missing_production_https_domain');
  }
  if (config.stripeLiveAllowed !== true && config.stripeLiveAllowed !== 'true') {
    blockers.push('STRIPE_LIVE_ALLOWED_not_enabled');
  }

  return {
    liveAvailable: blockers.length === 0,
    blockers,
  };
}

function getPublicStripeConfig() {
  const { liveAvailable, blockers } = getLiveReadiness();
  return {
    testAvailable: Boolean(config.stripeSecretKey?.startsWith('sk_test_')),
    liveAvailable,
    liveBlockers: blockers,
    defaultMode: 'test',
    testCardHint: '4242 4242 4242 4242',
  };
}

function normalizeMode(mode) {
  return mode === 'live' ? 'live' : 'test';
}

function assertModeAvailable(mode) {
  const normalized = normalizeMode(mode);
  if (normalized === 'live' && !getLiveReadiness().liveAvailable) {
    const err = new Error('Live mode is not ready');
    err.status = 400;
    err.code = 'LIVE_MODE_NOT_READY';
    err.blockers = getLiveReadiness().blockers;
    throw err;
  }
  return normalized;
}

module.exports = {
  getStripeClient,
  getSecretKey,
  getWebhookSecret,
  getLiveReadiness,
  getPublicStripeConfig,
  normalizeMode,
  assertModeAvailable,
};
