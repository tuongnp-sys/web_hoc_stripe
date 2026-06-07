const { getPool } = require('../db/pool');

async function createPendingOrder({
  userId,
  amount,
  currency,
  productKey,
  stripeSessionId,
  mode = 'payment',
  goldAmount = 0,
  description = null,
  stripeMode = 'test',
}) {
  const { rows } = await getPool().query(
    `INSERT INTO orders (user_id, stripe_checkout_session_id, product_key, amount, currency, status, mode, gold_amount, description, stripe_mode)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9)
     RETURNING *`,
    [userId, stripeSessionId, productKey, amount, currency, mode, goldAmount, description, stripeMode]
  );
  return rows[0];
}

async function markOrderPaid(sessionId, paymentIntentId = null, invoiceId = null) {
  const { rows } = await getPool().query(
    `UPDATE orders
     SET status = 'paid', paid_at = NOW(),
         stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
         stripe_invoice_id = COALESCE($3, stripe_invoice_id),
         gold_unspent = CASE WHEN gold_amount > 0 THEN gold_amount ELSE gold_unspent END
     WHERE stripe_checkout_session_id = $1
     RETURNING *`,
    [sessionId, paymentIntentId, invoiceId]
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
    `UPDATE orders SET status = 'refunded', gold_unspent = 0
     WHERE stripe_payment_intent_id = $1 AND status != 'refunded'
     RETURNING *`,
    [paymentIntentId]
  );
  return rows[0] || null;
}

async function markOrderRefundedById(orderId) {
  const { rows } = await getPool().query(
    `UPDATE orders SET status = 'refunded', gold_unspent = 0
     WHERE id = $1 AND status = 'paid'
     RETURNING *`,
    [orderId]
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

async function listForUser(userId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await getPool().query(
    `SELECT id, product_key, amount, currency, status, mode, gold_amount, gold_unspent,
            description, stripe_invoice_id, stripe_checkout_session_id, access_enabled,
            created_at, paid_at
     FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

async function listPendingForUser(userId) {
  const { rows } = await getPool().query(
    `SELECT id, stripe_checkout_session_id, product_key, status, created_at, stripe_mode
     FROM orders WHERE user_id = $1 AND status = 'pending'
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function countForUser(userId) {
  const { rows } = await getPool().query(
    'SELECT COUNT(*)::int AS count FROM orders WHERE user_id = $1',
    [userId]
  );
  return rows[0].count;
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
  markOrderRefundedById,
  findBySessionId,
  findById,
  listForUser,
  listPendingForUser,
  countForUser,
  listAll,
};
