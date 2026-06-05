const { getPool } = require('../db/pool');

async function upsertFromStripe({ userId, stripeSubscriptionId, stripePriceId, status, currentPeriodEnd }) {
  const { rows } = await getPool().query(
    `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_price_id, status, current_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (stripe_subscription_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       current_period_end = EXCLUDED.current_period_end,
       stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, subscriptions.stripe_price_id),
       updated_at = NOW()
     RETURNING *`,
    [userId, stripeSubscriptionId, stripePriceId, status, currentPeriodEnd]
  );
  return rows[0];
}

async function findByStripeId(stripeSubscriptionId) {
  const { rows } = await getPool().query(
    'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1',
    [stripeSubscriptionId]
  );
  return rows[0] || null;
}

async function listForUser(userId) {
  const { rows } = await getPool().query(
    `SELECT stripe_subscription_id, stripe_price_id, status, current_period_end, created_at
     FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

module.exports = { upsertFromStripe, findByStripeId, listForUser };
