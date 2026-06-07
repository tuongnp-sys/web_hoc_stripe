const express = require('express');
const { config } = require('../config');
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const { requireStripeMode } = require('../middleware/stripeMode');
const stripeService = require('../services/stripe');
const orders = require('../services/orders');
const { isProductEnabled } = require('../services/productCatalog');
const {
  fulfillCheckoutSession,
  syncPendingOrdersForUser,
} = require('../services/webhookHandler');

const router = express.Router();

async function startCheckout(req, res, next, productKey) {
  try {
    const product = stripeService.PRODUCTS[productKey];
    if (!product) {
      return res.status(400).json({ error: 'Product not found' });
    }
    if (!(await isProductEnabled(productKey))) {
      return res.status(400).json({ error: 'This product is currently unavailable', code: 'PRODUCT_DISABLED' });
    }

    if (product.mode === 'subscription') {
      const entitlements = require('../services/entitlements');
      const { entitlementForProduct } = require('../services/webhookHandler');
      const featureKey = entitlementForProduct(productKey);
      if (featureKey && (await entitlements.hasEntitlement(req.user.id, featureKey))) {
        return res.status(400).json({ error: 'You already own this subscription' });
      }
    }

    const successUrl = `${config.clientUrl}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${config.clientUrl}/cancel`;

    const session = await stripeService.createCheckoutSession({
      user: req.user,
      productKey,
      successUrl,
      cancelUrl,
      stripeMode: req.stripeMode,
    });

    await orders.createPendingOrder({
      userId: req.user.id,
      amount: product.amount,
      currency: product.currency,
      productKey: product.key,
      stripeSessionId: session.id,
      mode: product.mode,
      goldAmount: product.gold || 0,
      description: product.name,
      stripeMode: req.stripeMode,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
}

router.use(requireStripeMode);

router.post('/deposit', requireAuth, requireVerifiedEmail, (req, res, next) => {
  const { productKey } = req.body;
  if (!productKey || !stripeService.PRODUCTS[productKey]) {
    return res.status(400).json({ error: 'Invalid product' });
  }
  if (stripeService.PRODUCTS[productKey].mode === 'subscription') {
    return res.status(400).json({ error: 'Use /subscription for subscriptions' });
  }
  startCheckout(req, res, next, productKey);
});

router.post('/subscription', requireAuth, requireVerifiedEmail, (req, res, next) => {
  startCheckout(req, res, next, 'premium_monthly');
});

router.post('/sync-pending', requireAuth, async (req, res, next) => {
  try {
    const result = await syncPendingOrdersForUser(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/verify-session/:sessionId', requireAuth, async (req, res, next) => {
  try {
    const session = await stripeService.retrieveSession(req.params.sessionId, req.stripeMode);

    if (String(session.metadata?.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Session does not belong to this account' });
    }

    const result = await fulfillCheckoutSession(session);

    if (result.fulfilled) {
      return res.json({
        paid: true,
        productKey: result.productKey,
        goldCredited: result.goldCredited,
        goldBalance: result.goldBalance,
      });
    }

    res.json({
      paid: false,
      status: result.status || session.payment_status || session.status,
      reason: result.reason,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
