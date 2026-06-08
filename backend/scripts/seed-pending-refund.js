/**
 * Seed a pending refund request for E2E testing (abc@gmail.com gold order).
 */
require('../src/config').validateConfig();
const { getPool } = require('../src/db/pool');
const refunds = require('../src/services/refunds');

async function main() {
  const pool = getPool();
  const { rows: users } = await pool.query(
    "SELECT id, email FROM users WHERE email = 'abc@gmail.com'"
  );
  if (!users[0]) throw new Error('abc@gmail.com not found');

  const { rows: orders } = await pool.query(
    `SELECT id, product_key, gold_unspent, status FROM orders
     WHERE user_id = $1 AND status = 'paid' AND gold_unspent > 0
     ORDER BY created_at DESC LIMIT 1`,
    [users[0].id]
  );
  if (!orders[0]) throw new Error('No eligible order for abc@gmail.com');

  const existing = await refunds.findByOrderId(orders[0].id);
  if (existing?.status === 'pending') {
    console.log('Already pending:', existing.id);
    return;
  }
  if (existing) {
    await pool.query('DELETE FROM refund_requests WHERE order_id = $1', [orders[0].id]);
  }

  const req = await refunds.createRequest(
    users[0].id,
    orders[0].id,
    'other',
    'Test pending refund request'
  );
  console.log('Created pending refund:', req.id, 'for order', orders[0].product_key);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
