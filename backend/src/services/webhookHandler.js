const stripeService = require('./stripe');
const orders = require('./orders');
const entitlements = require('./entitlements');
const subscriptions = require('./subscriptions');
const wallet = require('./wallet');
const game = require('./game');
const refunds = require('./refunds');

const PRODUCT_ENTITLEMENT = {
  premium_monthly: 'premium',
};

function entitlementForProduct(productKey) {
  return PRODUCT_ENTITLEMENT[productKey] || null;
}

function stripeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id || null;
}

function isCheckoutSessionComplete(session) {
  if (session.status === 'complete') return true;
  if (session.payment_status === 'paid') return true;
  if (session.mode === 'subscription' && session.status === 'complete') return true;
  return false;
}

function subscriptionPeriodEnd(sub) {
  const ts = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

async function fulfillCheckoutSession(session) {
  const userId = session.metadata?.userId;
  const productKey = session.metadata?.productKey;
  if (!userId || !productKey) {
    return { fulfilled: false, reason: 'missing_metadata' };
  }

  if (!isCheckoutSessionComplete(session)) {
    return {
      fulfilled: false,
      reason: 'not_complete',
      status: session.payment_status || session.status,
    };
  }

  const paymentIntentId = stripeId(session.payment_intent);
  const invoiceId = stripeId(session.invoice);

  const order = await orders.markOrderPaid(session.id, paymentIntentId, invoiceId);
  const product = stripeService.PRODUCTS[productKey];

  if (session.mode === 'subscription' && session.subscription) {
    const subId = stripeId(session.subscription);
    const stripeMode = session.metadata?.stripeMode || 'test';
    const sub = await stripeService.getStripeClient(stripeMode).subscriptions.retrieve(subId);
    const periodEnd = subscriptionPeriodEnd(sub);

    await subscriptions.upsertFromStripe({
      userId,
      stripeSubscriptionId: sub.id,
      stripePriceId: sub.items?.data?.[0]?.price?.id || null,
      status: sub.status,
      currentPeriodEnd: periodEnd,
    });

    const featureKey = entitlementForProduct(productKey);
    if (featureKey) {
      await entitlements.grantEntitlement(userId, featureKey, order?.id, periodEnd);
    }

    return { fulfilled: true, productKey, order, mode: 'subscription' };
  }

  if (product?.gold > 0 && order) {
    const { getPool } = require('../db/pool');
    const { rows } = await getPool().query(
      `SELECT 1 FROM wallet_transactions
       WHERE user_id = $1 AND order_id = $2 AND type = 'credit' LIMIT 1`,
      [userId, order.id]
    );
    if (rows.length === 0) {
      await wallet.creditGold(
        userId,
        product.gold,
        order.id,
        `Purchased ${product.name} (+${product.gold} Gold)`
      );
    }
    return {
      fulfilled: true,
      productKey,
      order,
      mode: 'payment',
      goldCredited: product.gold,
      goldBalance: await wallet.getBalance(userId),
    };
  }

  const energyConfig = game.PRODUCT_ENERGY[productKey];
  if (energyConfig && order) {
    const energyBalance = await game.creditEnergy(
      userId,
      energyConfig.amount,
      order.id,
      { mode: energyConfig.mode }
    );
    return {
      fulfilled: true,
      productKey,
      order,
      mode: 'payment',
      energyCredited: energyConfig.amount,
      energyBalance,
    };
  }

  return { fulfilled: true, productKey, order, mode: session.mode };
}

async function syncPendingOrdersForUser(userId) {
  const pending = await orders.listPendingForUser(userId);
  let synced = 0;

  for (const order of pending) {
    if (!order.stripe_checkout_session_id) continue;
    try {
      const session = await stripeService.retrieveSession(
        order.stripe_checkout_session_id,
        order.stripe_mode || 'test'
      );
      if (String(session.metadata?.userId) !== String(userId)) continue;

      if (session.status === 'expired') {
        await orders.markOrderExpired(session.id);
        continue;
      }

      const result = await fulfillCheckoutSession(session);
      if (result.fulfilled) synced += 1;
    } catch (err) {
      console.error('[sync-pending]', order.id, err.message);
    }
  }

  return { synced, checked: pending.length };
}

async function handleCheckoutCompleted(session) {
  await fulfillCheckoutSession(session);
}

async function handleCheckoutExpired(session) {
  await orders.markOrderExpired(session.id);
}

async function handleSubscriptionUpdated(sub) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    const existing = await subscriptions.findByStripeId(sub.id);
    if (!existing) return;
    await syncSubscription(existing.user_id, sub);
    return;
  }
  await syncSubscription(userId, sub);
}

async function syncSubscription(userId, sub) {
  const periodEnd = subscriptionPeriodEnd(sub);
  await subscriptions.upsertFromStripe({
    userId,
    stripeSubscriptionId: sub.id,
    stripePriceId: sub.items?.data?.[0]?.price?.id || null,
    status: sub.status,
    currentPeriodEnd: periodEnd,
  });

  const active = ['active', 'trialing'].includes(sub.status);
  if (active) {
    await entitlements.grantEntitlement(userId, 'premium', null, periodEnd);
  } else {
    await entitlements.revokeEntitlement(userId, 'premium');
  }
}

async function handleChargeRefunded(charge) {
  const paymentIntentId = stripeId(charge.payment_intent);
  if (!paymentIntentId) return;

  const order = await orders.markOrderRefunded(paymentIntentId);
  if (!order) return;

  if (order.gold_amount > 0) {
    await wallet.debitGoldForRefund(
      order.user_id,
      order.gold_unspent || order.gold_amount,
      order.id,
      'Charge refunded'
    );
  }

  const energyConfig = game.PRODUCT_ENERGY[order.product_key];
  if (energyConfig) {
    await game.debitEnergyForRefund(order.user_id, energyConfig, order.id);
  }

  const featureKey = entitlementForProduct(order.product_key);
  if (featureKey) {
    await entitlements.revokeEntitlement(order.user_id, featureKey);
  }

  await refunds.markCompletedByStripeRefund(charge.refunds?.data?.[0]?.id, paymentIntentId);
}

async function processEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'checkout.session.expired':
      await handleCheckoutExpired(event.data.object);
      break;
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'charge.refunded':
      await handleChargeRefunded(event.data.object);
      break;
    default:
      break;
  }
}

module.exports = {
  processEvent,
  entitlementForProduct,
  fulfillCheckoutSession,
  syncPendingOrdersForUser,
  isCheckoutSessionComplete,
};
