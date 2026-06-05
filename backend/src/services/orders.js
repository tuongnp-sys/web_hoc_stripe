const { getPool } = require('../db/pool');

async function createPendingOrder({
  userId,
  amount,
  currency,
  productKey,
  stripeSessionId,
  mode = 'payment',
}) {
  const { rows } = await getPool().query(
    `INSERT INTO orders (user_id, stripe_checkout_session_id, product_key, amount, currency, status, mode)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6)
     RETURNING *`,
    [userId, stripeSessionId, productKey, amount, currency, mode]
  );
  return rows[0];
}

async function markOrderPaid(sessionId, paymentIntentId = null) {
  const { rows } = await getPool().query(
    `UPDATE orders
     SET status = 'paid', paid_at = NOW(),
         stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id)
     WHERE stripe_checkout_session_id = $1
     RETURNING *`,
    [sessionId, paymentIntentId]
  );
  return rows[0] || null;
}

async function markOrderExpired(sessionId) {
  const { rows } = await getPool().query(
    `UPDATE orders SET status = 'expired'
     WHERE stripe_checkout_session_id = $1 AND status = 'pending'
     RETURNING *`,
    [sessionId]
  );
  return rows[0] || null;
}

async function markOrderRefunded(paymentIntentId) {
  const { rows } = await getPool().query(
    `UPDATE orders SET status = 'refunded'
     WHERE stripe_payment_intent_id = $1
     RETURNING *`,
    [paymentIntentId]
  );
  return rows[0] || null;
}

async function findBySessionId(sessionId) {
  const { rows } = await getPool().query(
    'SELECT * FROM orders WHERE stripe_checkout_session_id = $1',
    [sessionId]
  );
  return rows[0] || null;
}

async function findById(orderId, userId) {
  const { rows } = await getPool().query(
    'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
    [orderId, userId]
  );
  return rows[0] || null;
}

async function listForUser(userId) {
  const { rows } = await getPool().query(
    `SELECT id, product_key, amount, currency, status, mode, created_at, paid_at
     FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function listAll(limit = 50) {
  const { rows } = await getPool().query(
    `SELECT o.id, o.product_key, o.amount, o.currency, o.status, o.mode, o.created_at, o.paid_at,
            u.email
     FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = {
  createPendingOrder,
  markOrderPaid,
  markOrderExpired,
  markOrderRefunded,
  findBySessionId,
  findById,
  listForUser,
  listAll,
};
