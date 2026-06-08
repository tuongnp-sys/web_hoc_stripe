const { config } = require('../config');
const { getStripeClient, getWebhookSecret, normalizeMode } = require('./stripeMode');
const users = require('./users');

const PRODUCTS = {
  gold_starter: {
    key: 'gold_starter',
    name: 'Starter Pack',
    description: '500 Gold — perfect for new players',
    amount: 50,
    currency: 'usd',
    mode: 'payment',
    gold: 500,
    badge: null,
    savings: null,
  },
  gold_popular: {
    key: 'gold_popular',
    name: 'Popular Pack',
    description: '1,200 Gold — our most popular choice',
    amount: 999,
    currency: 'usd',
    mode: 'payment',
    gold: 1200,
    badge: 'Popular',
    savings: 'Save 20%',
  },
  gold_pro: {
    key: 'gold_pro',
    name: 'Pro Gamer Pack',
    description: '2,500 Gold — for dedicated players',
    amount: 1999,
    currency: 'usd',
    mode: 'payment',
    gold: 2500,
    badge: null,
    savings: null,
  },
  gold_mega: {
    key: 'gold_mega',
    name: 'Mega Pack',
    description: '5,500 Gold — best value per Gold',
    amount: 3999,
    currency: 'usd',
    mode: 'payment',
    gold: 5500,
    badge: 'Best Value',
    savings: 'Save 30%',
  },
  energy_refill: {
    key: 'energy_refill',
    name: 'Energy Refill',
    description: 'Restore energy to full (5 plays)',
    amount: 99,
    currency: 'usd',
    mode: 'payment',
    gold: 0,
    energy: 5,
    energyMode: 'full',
    badge: null,
    savings: null,
  },
  energy_pack_5: {
    key: 'energy_pack_5',
    name: 'Energy Pack',
    description: '+5 energy for more meditation runs',
    amount: 199,
    currency: 'usd',
    mode: 'payment',
    gold: 0,
    energy: 5,
    energyMode: 'add',
    badge: null,
    savings: null,
  },
  premium_monthly: {
    key: 'premium_monthly',
    name: 'Premium Monthly',
    description: 'Premium perks — renews monthly',
    amount: 999,
    currency: 'usd',
    mode: 'subscription',
    gold: 0,
    entitlement: 'premium',
    interval: 'month',
    badge: null,
    savings: null,
  },
};

const GOLD_PACK_KEYS = ['gold_starter', 'gold_popular', 'gold_pro', 'gold_mega'];

function formatPrice(product) {
  const price = `$${(product.amount / 100).toFixed(2)}`;
  return product.mode === 'subscription' ? `${price}/mo` : price;
}

function getProductCategory(product) {
  if (product.energy) return 'energy';
  if (product.gold > 0) return 'gold';
  if (product.entitlement) return 'vip';
  return 'other';
}

function getProducts() {
  return Object.values(PRODUCTS).map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description,
    amount: p.amount,
    currency: p.currency,
    mode: p.mode,
    gold: p.gold || 0,
    energy: p.energy || 0,
    energyMode: p.energyMode || null,
    category: getProductCategory(p),
    badge: p.badge,
    savings: p.savings,
    displayPrice: formatPrice(p),
  }));
}

function isLegacyTestCustomerId(customerId) {
  return !customerId || customerId.startsWith('cus_test');
}

async function getOrCreateCustomer(user, stripeMode = 'test') {
  const stripe = getStripeClient(stripeMode);
  let customerId = user.stripe_customer_id;

  if (customerId && isLegacyTestCustomerId(customerId) && stripeMode === 'live') {
    await users.clearStripeCustomerId(user.id);
    customerId = null;
  }

  if (customerId && stripeMode === 'live') {
    try {
      await stripe.customers.retrieve(customerId);
    } catch (err) {
      if (err.code === 'resource_missing' || err.statusCode === 404) {
        await users.clearStripeCustomerId(user.id);
        customerId = null;
      } else {
        throw err;
      }
    }
  }

  if (customerId) return customerId;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id, stripeMode },
  });
  await users.setStripeCustomerId(user.id, customer.id);
  return customer.id;
}

function buildLineItem(product) {
  const priceMap = {
    gold_starter: config.stripePriceGoldStarter,
    gold_popular: config.stripePriceGoldPopular,
    gold_pro: config.stripePriceGoldPro,
    gold_mega: config.stripePriceGoldMega,
    premium_monthly: config.stripePricePremiumMonthly,
  };

  const priceId = priceMap[product.key];
  if (priceId && !product.priceOverridden) return { price: priceId, quantity: 1 };

  if (product.mode === 'payment') {
    return {
      price_data: {
        currency: product.currency,
        product_data: { name: product.name, description: product.description },
        unit_amount: product.amount,
      },
      quantity: 1,
    };
  }

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

async function createCheckoutSession({ user, product, successUrl, cancelUrl, stripeMode = 'test' }) {
  const mode = normalizeMode(stripeMode);
  const stripe = getStripeClient(mode);
  if (!product) throw new Error('Product not found');

  const customerId = await getOrCreateCustomer(user, mode);
  const sessionParams = {
    mode: product.mode,
    payment_method_types: ['card', 'link'],
    customer: customerId,
    line_items: [buildLineItem(product)],
    metadata: { userId: user.id, productKey: product.key, stripeMode: mode },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    customer_update: { address: 'auto' },
  };

  if (config.stripeTaxEnabled) {
    sessionParams.automatic_tax = { enabled: true };
  }

  if (product.mode === 'payment') {
    sessionParams.invoice_creation = { enabled: true };
  }

  if (product.mode === 'subscription') {
    sessionParams.subscription_data = {
      metadata: { userId: user.id, productKey: product.key, stripeMode: mode },
    };
  }

  return stripe.checkout.sessions.create(sessionParams);
}

async function retrieveSession(sessionId, stripeMode = 'test') {
  const stripe = getStripeClient(normalizeMode(stripeMode));
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'total_details', 'subscription', 'payment_intent', 'invoice'],
  });
}

async function createPortalSession(customerId, returnUrl, stripeMode = 'test') {
  const stripe = getStripeClient(normalizeMode(stripeMode));
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

async function getInvoicePdfUrl(invoiceId, stripeMode = 'test') {
  const stripe = getStripeClient(normalizeMode(stripeMode));
  const invoice = await stripe.invoices.retrieve(invoiceId);
  return invoice.invoice_pdf;
}

function constructWebhookEvent(rawBody, signature, stripeMode = 'test') {
  const mode = normalizeMode(stripeMode);
  const secret = getWebhookSecret(mode);
  if (!secret) {
    throw new Error(`Webhook secret not configured for ${mode} mode`);
  }
  const stripe = getStripeClient(mode);
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

function isGoldPack(productKey) {
  return GOLD_PACK_KEYS.includes(productKey);
}

// Backward compat: default test client
const stripe = getStripeClient('test');

module.exports = {
  stripe,
  getStripeClient,
  PRODUCTS,
  GOLD_PACK_KEYS,
  getProducts,
  getProductCategory,
  getOrCreateCustomer,
  createCheckoutSession,
  retrieveSession,
  createPortalSession,
  getInvoicePdfUrl,
  constructWebhookEvent,
  isGoldPack,
  formatPrice,
};
