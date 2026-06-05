/**
 * Smoke test API (cần server đang chạy + DATABASE_URL hợp lệ).
 * Usage: node scripts/smoke-test.js
 */
const API = process.env.API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const email = `test_${Date.now()}@lab.local`;
  const password = 'test123456';

  console.log('1. Health...');
  const health = await request('/health');
  if (!health.body.ok) throw new Error('Health failed');
  console.log('   OK');

  console.log('2. Register...');
  const reg = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (reg.status !== 201) throw new Error(JSON.stringify(reg.body));
  const token = reg.body.token;
  console.log('   OK', email);

  console.log('3. Products...');
  const products = await request('/api/products');
  if (!products.body.products?.length) throw new Error('No products');
  console.log('   OK', products.body.products.length, 'products');

  console.log('4. Entitlements (locked)...');
  const ent = await request('/api/entitlements', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (ent.body.gameUnlock !== false) throw new Error('Expected locked');
  console.log('   OK');

  console.log('5. Create checkout session...');
  const checkout = await request('/api/checkout/one-time', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!checkout.body.url?.includes('checkout.stripe.com')) {
    throw new Error(JSON.stringify(checkout.body));
  }
  console.log('   OK', checkout.body.sessionId);

  console.log('\nSmoke test passed.');
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
