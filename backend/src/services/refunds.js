const { getPool } = require('../db/pool');
const stripeService = require('./stripe');
const orders = require('./orders');
const wallet = require('./wallet');

const REFUND_WINDOW_MS = 48 * 60 * 60 * 1000;

const VALID_REASONS = [
  'wrong_package',
  'system_error',
  'device_incompatible',
  'other',
];

function isEligible(order) {
  if (!order || order.status !== 'paid') return false;
  if (order.mode === 'subscription') return false;
  const age = Date.now() - new Date(order.paid_at || order.created_at).getTime();
  if (age > REFUND_WINDOW_MS) return false;
  return (order.gold_unspent ?? 0) > 0;
}

async function findByOrderId(orderId) {
  const { rows } = await getPool().query(
    'SELECT * FROM refund_requests WHERE order_id = $1',
    [orderId]
  );
  return rows[0] || null;
}

async function listForUser(userId) {
  const { rows } = await getPool().query(
    `SELECT r.*, o.product_key, o.amount, o.currency, o.description
     FROM refund_requests r
     JOIN orders o ON o.id = r.order_id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  );
  return rows;
}

async function createRequest(userId, orderId, reason, reasonDetail) {
  if (!VALID_REASONS.includes(reason)) {
    throw new Error('Invalid refund reason');
  }

  const order = await orders.findById(orderId, userId);
  if (!order) throw new Error('Order not found');

  const existing = await findByOrderId(orderId);
  if (existing) throw new Error('Refund already requested for this order');

  if (!isEligible(order)) {
    throw new Error('This order is not eligible for refund');
  }

  const { rows } = await getPool().query(
    `INSERT INTO refund_requests (user_id, order_id, reason, reason_detail, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [userId, orderId, reason, reasonDetail || null]
  );
  return rows[0];
}

async function processRefund(requestId) {
  const { rows } = await getPool().query(
    `SELECT r.*, o.stripe_payment_intent_id, o.gold_unspent, o.gold_amount, o.user_id
     FROM refund_requests r
     JOIN orders o ON o.id = r.order_id
     WHERE r.id = $1`,
    [requestId]
  );
  const request = rows[0];
  if (!request) throw new Error('Refund request not found');
  if (request.status !== 'pending') return request;

  const order = await orders.findById(request.order_id, request.user_id);
  if (!isEligible(order)) {
    await getPool().query(
      `UPDATE refund_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
      [requestId]
    );
    throw new Error('Order no longer eligible');
  }

  await getPool().query(
    `UPDATE refund_requests SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [requestId]
  );

  if (!request.stripe_payment_intent_id) {
    throw new Error('Missing payment intent');
  }

  await wallet.debitGoldForRefund(
    request.user_id,
    order.gold_unspent || order.gold_amount,
    order.id,
    'Refund deduction'
  );

  await orders.markOrderRefundedById(order.id);

  const refund = await stripeService.stripe.refunds.create({
    payment_intent: request.stripe_payment_intent_id,
  });

  await getPool().query(
    `UPDATE refund_requests SET status = 'completed', stripe_refund_id = $2, updated_at = NOW()
     WHERE id = $1`,
    [requestId, refund.id]
  );

  return findById(requestId);
}

async function findById(id) {
  const { rows } = await getPool().query('SELECT * FROM refund_requests WHERE id = $1', [id]);
  return rows[0] || null;
}

async function markCompletedByStripeRefund(stripeRefundId, paymentIntentId) {
  await getPool().query(
    `UPDATE refund_requests SET status = 'completed', stripe_refund_id = $2, updated_at = NOW()
     WHERE order_id IN (
       SELECT id FROM orders WHERE stripe_payment_intent_id = $1
     ) AND status IN ('processing', 'pending')`,
    [paymentIntentId, stripeRefundId]
  );
}

module.exports = {
  REFUND_WINDOW_MS,
  VALID_REASONS,
  isEligible,
  findByOrderId,
  listForUser,
  createRequest,
  processRefund,
  findById,
  markCompletedByStripeRefund,
};
