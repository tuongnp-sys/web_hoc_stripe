const express = require('express');
const { config } = require('../config');
const { requireAuth } = require('../middleware/auth');
const stripeService = require('../services/stripe');
const orders = require('../services/orders');
const entitlements = require('../services/entitlements');
const subscriptions = require('../services/subscriptions');
const { entitlementForProduct } = require('../services/webhookHandler');

const router = express.Router();

async function startCheckout(req, res, next, productKey) {
  try {
    const product = stripeService.PRODUCTS[productKey];
    if (!product) {
      return res.status(400).json({ error: 'Sản phẩm không tồn tại' });
    }

    const featureKey = entitlementForProduct(productKey);
    if (await entitlements.hasEntitlement(req.user.id, featureKey)) {
      return res.status(400).json({ error: 'Bạn đã sở hữu gói này rồi' });
    }

    const successUrl = `${config.clientUrl}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${config.clientUrl}/cancel`;

    const session = await stripeService.createCheckoutSession({
      user: req.user,
      productKey,
      successUrl,
      cancelUrl,
    });

    await orders.createPendingOrder({
      userId: req.user.id,
      amount: product.amount,
      currency: product.currency,
      productKey: product.key,
      stripeSessionId: session.id,
      mode: product.mode,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
}

router.post('/one-time', requireAuth, (req, res, next) => {
  startCheckout(req, res, next, 'game_unlock');
});

router.post('/subscription', requireAuth, (req, res, next) => {
  startCheckout(req, res, next, 'premium_monthly');
});

router.get('/verify-session/:sessionId', requireAuth, async (req, res, next) => {
  try {
    const session = await stripeService.retrieveSession(req.params.sessionId);

    if (session.metadata?.userId !== req.user.id) {
      return res.status(403).json({ error: 'Phiên thanh toán không thuộc tài khoản này' });
    }

    const productKey = session.metadata?.productKey || 'game_unlock';
    const featureKey = entitlementForProduct(productKey);

    if (session.payment_status === 'paid' || session.status === 'complete') {
      const order = await orders.markOrderPaid(session.id, session.payment_intent);

      if (session.mode === 'subscription' && session.subscription) {
        const sub = await stripeService.stripe.subscriptions.retrieve(session.subscription);
        await subscriptions.upsertFromStripe({
          userId: req.user.id,
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items?.data?.[0]?.price?.id || null,
          status: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        });
        await entitlements.grantEntitlement(
          req.user.id,
          featureKey,
          order?.id,
          new Date(sub.current_period_end * 1000)
        );
      } else {
        await entitlements.grantEntitlement(req.user.id, featureKey, order?.id);
      }

      return res.json({ paid: true, userId: req.user.id, productKey });
    }

    res.json({ paid: false, status: session.payment_status || session.status });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
