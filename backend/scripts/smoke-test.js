/**
 * Smoke test API (server running + valid DATABASE_URL).
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
  const email = `smoke_${Date.now()}@gmail.com`;
  const password = 'Test1234!';

  console.log('1. Health...');
  const health = await request('/health');
  if (!health.body.ok) throw new Error('Health failed');
  console.log('   OK');

  console.log('2. Register...');
  const reg = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      confirmPassword: password,
      acceptTerms: true,
      confirmAge: true,
    }),
  });
  if (reg.status !== 201) throw new Error(JSON.stringify(reg.body));
  const token = reg.body.token;
  console.log('   OK', email);

  console.log('3. Products...');
  const products = await request('/api/products');
  if (!products.body.products?.length) throw new Error('No products');
  console.log('   OK', products.body.products.length, 'products');

  console.log('4. Wallet...');
  const wallet = await request('/api/wallet', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (wallet.body.goldBalance !== 0) throw new Error('Expected 0 gold');
  console.log('   OK');

  console.log('5. Create checkout session (gold_starter)...');
  const checkout = await request('/api/checkout/deposit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productKey: 'gold_starter' }),
  });
  if (checkout.status === 403 && checkout.body.code === 'EMAIL_NOT_VERIFIED') {
    console.log('   SKIP (email not verified — expected for new accounts)');
  } else if (!checkout.body.url?.includes('checkout.stripe.com')) {
    throw new Error(JSON.stringify(checkout.body));
  } else {
    console.log('   OK', checkout.body.sessionId);
  }

  console.log('\nSmoke test passed.');
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
