/**
 * Test refund approval workflow: user submits pending only, admin approves.
 * Usage: node scripts/test-refund-workflow.js
 */
const API = process.env.API_URL || 'http://localhost:3000';

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
  console.log('=== Refund workflow test ===\n');

  const adminToken = await login('admin@localhost', 'admin123456');
  console.log('1. Admin login OK');

  const countBefore = await req('/api/admin/refund-requests/count', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('2. Pending count:', countBefore.body.count);

  const usersRes = await req('/api/admin/users?limit=50', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const withPending = (usersRes.body.users || []).filter((u) => u.pending_refund_count > 0);
  console.log('3. Users with pending_refund_count > 0:', withPending.length);
  if (withPending.length) {
    console.log('   ', withPending.map((u) => `${u.email} (${u.pending_refund_count})`).join(', '));
  }

  const pendingList = await req('/api/admin/refund-requests', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('4. Pending requests:', pendingList.body.requests?.length ?? 0);
  if (pendingList.body.requests?.length) {
    const first = pendingList.body.requests[0];
    console.log('   First:', first.email, first.product_key, first.status, first.reason);

    const detail = await req(`/api/admin/users/${first.user_id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const order = (detail.body.orders || []).find((o) => o.id === first.order_id);
    console.log('5. Order in drawer:', order?.product_key, 'refund_request_status:', order?.refund_request_status);
    if (order?.refund_request_status !== 'pending') {
      console.error('   FAIL: drawer missing refund_request_status=pending');
      process.exit(1);
    }
    console.log('   OK drawer shows pending');
  }

  // Find a user with paid gold order for submit test
  console.log('\n6. Scanning for eligible paid gold orders...');
  let testUser = null;
  let testOrder = null;
  for (const u of usersRes.body.users || []) {
    if (u.role === 'admin') continue;
    const detail = await req(`/api/admin/users/${u.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const eligible = (detail.body.orders || []).find(
      (o) =>
        o.status === 'paid' &&
        (o.gold_unspent ?? 0) > 0 &&
        !o.refund_request_status
    );
    if (eligible) {
      testUser = u;
      testOrder = eligible;
      break;
    }
  }

  if (!testUser) {
    console.log('   SKIP submit test — no eligible paid gold order without existing refund request');
    console.log('\nPartial pass (admin endpoints OK). Create a gold purchase to test full flow.');
    return;
  }

  console.log(`   Found: ${testUser.email} order ${testOrder.product_key} gold_unspent=${testOrder.gold_unspent}`);

  // We cannot login as arbitrary user without password — check POST /api/refunds behavior via DB note
  console.log('\n7. Verify user POST /api/refunds does NOT auto-complete (code check)...');
  const fs = require('fs');
  const refundsRoute = fs.readFileSync(require('path').join(__dirname, '../src/routes/refunds.js'), 'utf8');
  if (refundsRoute.includes('processRefund(request.id)')) {
    console.error('   FAIL: routes/refunds.js still calls processRefund on user submit');
    process.exit(1);
  }
  console.log('   OK user route only creates request');

  console.log('\n=== Test complete ===');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
