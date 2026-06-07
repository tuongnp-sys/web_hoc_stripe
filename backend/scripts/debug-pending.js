require('../src/config').validateConfig();
const { getPool } = require('../src/db/pool');
const stripeService = require('../src/services/stripe');
const { isCheckoutSessionComplete } = require('../src/services/webhookHandler');

(async () => {
  const { rows } = await getPool().query(
    `SELECT o.id, o.status, o.product_key, o.stripe_checkout_session_id, u.email
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE o.status = 'pending' ORDER BY o.created_at DESC LIMIT 10`
  );

  for (const order of rows) {
    console.log('\n---', order.email, order.product_key, order.stripe_checkout_session_id);
    if (!order.stripe_checkout_session_id) continue;
    try {
      const session = await stripeService.retrieveSession(order.stripe_checkout_session_id);
      console.log('  stripe status:', session.status, 'payment:', session.payment_status);
      console.log('  complete?', isCheckoutSessionComplete(session));
      console.log('  metadata:', session.metadata);
    } catch (e) {
      console.log('  ERROR:', e.message);
    }
  }
  process.exit(0);
})();
