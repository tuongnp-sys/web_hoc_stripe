/**
 * Test checkout API for a user by email.
 * Usage: node scripts/test-checkout.js c@gmail.com
 */
require('../src/config').validateConfig();
const jwt = require('jsonwebtoken');
const { config } = require('../src/config');
const { getPool } = require('../src/db/pool');
const stripeService = require('../src/services/stripe');
const { isEmailVerified } = require('../src/middleware/auth');

const email = process.argv[2] || 'c@gmail.com';
const API = process.env.API_URL || 'http://localhost:3000';

(async () => {
  const { rows } = await getPool().query('SELECT * FROM users WHERE email = $1', [
    email.toLowerCase(),
  ]);
  const user = rows[0];
  if (!user) {
    console.log('User not found:', email);
    process.exit(1);
  }

  console.log('email_verified (DB):', user.email_verified);
  console.log('isEmailVerified():', isEmailVerified(user));

  try {
    const { resolveProduct } = require('../src/services/productCatalog');
    const product = await resolveProduct('gold_starter');
    const session = await stripeService.createCheckoutSession({
      user,
      product,
      successUrl: `${config.clientUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${config.clientUrl}/cancel`,
    });
    console.log('Stripe session OK:', session.id);
  } catch (e) {
    console.log('Stripe session FAIL:', e.message);
    process.exit(1);
  }

  const token = jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: '1h',
  });

  for (const path of [
    { label: 'deposit', url: '/api/checkout/deposit', body: { productKey: 'gold_starter' } },
    { label: 'subscription', url: '/api/checkout/subscription', body: {} },
  ]) {
    const res = await fetch(`${API}${path.url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(path.body),
    });
    const body = await res.json();
    if (res.ok && body.url?.includes('checkout.stripe.com')) {
      console.log(`${path.label} API OK:`, body.sessionId);
    } else {
      console.log(`${path.label} API FAIL (${res.status}):`, body);
      process.exit(1);
    }
  }

  console.log('\nAll checkout tests passed.');
  process.exit(0);
})();
