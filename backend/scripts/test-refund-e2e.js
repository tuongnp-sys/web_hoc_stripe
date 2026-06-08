/**
 * Full E2E: user submit → pending only (gold unchanged) → admin reject.
 */
require('../src/config').validateConfig();
const API = process.env.API_URL || 'http://localhost:3000';
const { getPool } = require('../src/db/pool');
const bcrypt = require('bcryptjs');

async function req(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    ...rest,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function login(email, password) {
  const r = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (r.status !== 200) throw new Error(`Login failed ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token;
}

async function main() {
  console.log('=== Refund E2E test ===\n');

  const pool = getPool();
  const testEmail = `refund-e2e-${Date.now()}@test.local`;
  const testPassword = 'Test1234!';

  // Create user + paid gold order with unspent gold
  const passwordHash = await bcrypt.hash(testPassword, 10);
  const { rows: userRows } = await pool.query(
    `INSERT INTO users (email, password_hash, email_verified, role, account_status, terms_accepted_at, age_confirmed_at)
     VALUES ($1, $2, true, 'user', 'active', NOW(), NOW()) RETURNING id`,
    [testEmail, passwordHash]
  );
  const userId = userRows[0].id;

  const { rows: orderRows } = await pool.query(
    `INSERT INTO orders (user_id, product_key, description, amount, currency, status, mode,
                         gold_amount, gold_unspent, paid_at, stripe_payment_intent_id)
     VALUES ($1, 'gold_starter', 'Gold Starter (test)', 499, 'usd', 'paid', 'payment',
             1000, 1000, NOW(), 'pi_test_e2e_' || gen_random_uuid()::text)
     RETURNING id`,
    [userId]
  );
  const orderId = orderRows[0].id;

  await pool.query(
    `INSERT INTO wallets (user_id, gold_balance) VALUES ($1, 1000)
     ON CONFLICT (user_id) DO UPDATE SET gold_balance = wallets.gold_balance + 1000`,
    [userId]
  );

  const goldBefore = (await pool.query('SELECT gold_balance FROM wallets WHERE user_id = $1', [userId])).rows[0]
    .gold_balance;
  console.log('1. Seeded user', testEmail, 'order', orderId.slice(0, 8), 'gold=', goldBefore);

  const userToken = await login(testEmail, testPassword);
  console.log('2. User login OK');

  const submit = await req('/api/refunds', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ orderId, reason: 'other', reasonDetail: 'E2E test refund' }),
  });
  if (submit.status !== 201) {
    throw new Error(`User submit failed: ${submit.status} ${JSON.stringify(submit.body)}`);
  }
  if (submit.body.request?.status !== 'pending') {
    throw new Error(`Expected pending, got ${submit.body.request?.status}`);
  }
  console.log('3. User submit OK — status:', submit.body.request.status);

  const goldAfter = (await pool.query('SELECT gold_balance FROM wallets WHERE user_id = $1', [userId])).rows[0]
    .gold_balance;
  if (goldAfter !== goldBefore) {
    throw new Error(`FAIL: Gold changed on submit! ${goldBefore} → ${goldAfter}`);
  }
  console.log('4. Gold unchanged after submit:', goldAfter, 'OK');

  const ordersRes = await req('/api/orders', {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  const order = ordersRes.body.orders?.find((o) => o.id === orderId);
  if (!order?.refundRequest || order.refundRequest.status !== 'pending') {
    throw new Error('FAIL: /api/orders missing refundRequest pending');
  }
  if (order.refundEligible) {
    throw new Error('FAIL: refundEligible still true after submit');
  }
  console.log('5. Billing API shows Awaiting review, no Request Refund button OK');

  const adminToken = await login('admin@localhost', 'admin123456');
  const count = await req('/api/admin/refund-requests/count', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('6. Admin pending count:', count.body.count);

  const reject = await req(`/api/admin/orders/${orderId}/refund/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (reject.status !== 200) {
    throw new Error(`Admin reject failed: ${reject.status} ${JSON.stringify(reject.body)}`);
  }
  console.log('7. Admin reject OK');

  const goldFinal = (await pool.query('SELECT gold_balance FROM wallets WHERE user_id = $1', [userId])).rows[0]
    .gold_balance;
  if (goldFinal !== goldBefore) {
    throw new Error(`FAIL: Gold changed on reject! ${goldBefore} → ${goldFinal}`);
  }
  console.log('8. Gold unchanged after reject:', goldFinal, 'OK');

  // Cleanup
  await pool.query('DELETE FROM refund_requests WHERE order_id = $1', [orderId]);
  await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
  await pool.query('DELETE FROM wallets WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  console.log('\n=== ALL E2E TESTS PASSED ===');
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
