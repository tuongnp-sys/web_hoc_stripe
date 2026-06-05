const stripeService = require('./stripe');
const orders = require('./orders');
const entitlements = require('./entitlements');
const subscriptions = require('./subscriptions');

const PRODUCT_ENTITLEMENT = {
  game_unlock: 'game_unlock',
  premium_monthly: 'premium',
};

function entitlementForProduct(productKey) {
  return PRODUCT_ENTITLEMENT[productKey] || productKey;
}

async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId;
  const productKey = session.metadata?.productKey || 'game_unlock';
  if (!userId) return;

  const order = await orders.markOrderPaid(session.id, session.payment_intent);
  const featureKey = entitlementForProduct(productKey);

  if (session.mode === 'subscription' && session.subscription) {
    const sub = await stripeService.stripe.subscriptions.retrieve(session.subscription);
    await subscriptions.upsertFromStripe({
      userId,
      stripeSubscriptionId: sub.id,
      stripePriceId: sub.items?.data?.[0]?.price?.id || null,
      status: sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    });
    await entitlements.grantEntitlement(
      userId,
      featureKey,
      order?.id,
      new Date(sub.current_period_end * 1000)
    );
    return;
  }

  await entitlements.grantEntitlement(userId, featureKey, order?.id);
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
  await subscriptions.upsertFromStripe({
    userId,
    stripeSubscriptionId: sub.id,
    stripePriceId: sub.items?.data?.[0]?.price?.id || null,
    status: sub.status,
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  });

  const active = ['active', 'trialing'].includes(sub.status);
  if (active) {
    await entitlements.grantEntitlement(
      userId,
      'premium',
      null,
      new Date(sub.current_period_end * 1000)
    );
  } else {
    await entitlements.revokeEntitlement(userId, 'premium');
  }
}

async function handleChargeRefunded(charge) {
  const paymentIntentId = charge.payment_intent;
  if (!paymentIntentId) return;

  const order = await orders.markOrderRefunded(paymentIntentId);
  if (!order) return;

  const featureKey = entitlementForProduct(order.product_key);
  await entitlements.revokeEntitlement(order.user_id, featureKey);
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

module.exports = { processEvent, entitlementForProduct };
