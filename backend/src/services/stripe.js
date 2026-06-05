const Stripe = require('stripe');
const { config } = require('../config');
const users = require('./users');

const stripe = new Stripe(config.stripeSecretKey);

const PRODUCTS = {
  game_unlock: {
    key: 'game_unlock',
    name: 'Mở khóa toàn bộ Game',
    description: 'Nạp tiền để tiếp tục chơi màn tiếp theo',
    amount: 499,
    currency: 'usd',
    mode: 'payment',
    entitlement: 'game_unlock',
  },
  premium_monthly: {
    key: 'premium_monthly',
    name: 'Premium Monthly',
    description: 'Truy cập premium — gia hạn hàng tháng',
    amount: 999,
    currency: 'usd',
    mode: 'subscription',
    entitlement: 'premium',
    interval: 'month',
  },
};

function getProducts() {
  return Object.values(PRODUCTS).map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description,
    amount: p.amount,
    currency: p.currency,
    mode: p.mode,
    displayPrice: p.mode === 'subscription' ? `$${(p.amount / 100).toFixed(2)}/tháng` : `$${(p.amount / 100).toFixed(2)}`,
  }));
}

async function getOrCreateCustomer(user) {
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });
  await users.setStripeCustomerId(user.id, customer.id);
  return customer.id;
}

function buildLineItem(product) {
  if (product.mode === 'payment') {
    const priceId = config.stripePriceGameUnlock;
    if (priceId) return { price: priceId, quantity: 1 };
    return {
      price_data: {
        currency: product.currency,
        product_data: { name: product.name, description: product.description },
        unit_amount: product.amount,
      },
      quantity: 1,
    };
  }

  const priceId = config.stripePricePremiumMonthly;
  if (priceId) return { price: priceId, quantity: 1 };
  return {
    price_data: {
      currency: product.currency,
      product_data: { name: product.name, description: product.description },
      unit_amount: product.amount,
      recurring: { interval: product.interval },
    },
    quantity: 1,
  };
}

async function createCheckoutSession({ user, productKey, successUrl, cancelUrl }) {
  const product = PRODUCTS[productKey];
  if (!product) throw new Error('Sản phẩm không tồn tại');

  const customerId = await getOrCreateCustomer(user);
  const sessionParams = {
    mode: product.mode,
    payment_method_types: ['card'],
    customer: customerId,
    line_items: [buildLineItem(product)],
    metadata: { userId: user.id, productKey: product.key },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  if (product.mode === 'subscription') {
    sessionParams.subscription_data = {
      metadata: { userId: user.id, productKey: product.key },
    };
  }

  return stripe.checkout.sessions.create(sessionParams);
}

async function createGameUnlockSession(opts) {
  return createCheckoutSession({
    user: { id: opts.userId, email: opts.userEmail, stripe_customer_id: opts.stripeCustomerId },
    productKey: 'game_unlock',
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
  });
}

async function retrieveSession(sessionId) {
  return stripe.checkout.sessions.retrieve(sessionId);
}

async function createPortalSession(customerId, returnUrl) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

function constructWebhookEvent(rawBody, signature) {
  return stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
}

module.exports = {
  stripe,
  PRODUCTS,
  getProducts,
  getOrCreateCustomer,
  createCheckoutSession,
  createGameUnlockSession,
  retrieveSession,
  createPortalSession,
  constructWebhookEvent,
  GAME_UNLOCK_AMOUNT: PRODUCTS.game_unlock.amount,
  GAME_UNLOCK_CURRENCY: PRODUCTS.game_unlock.currency,
};
