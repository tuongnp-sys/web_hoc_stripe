/**
 * Production smoke test (API + CORS).
 * Usage: API_URL=https://web-hoc-stripe.onrender.com CLIENT_ORIGIN=https://joymed.vercel.app node scripts/prod-smoke.js
 */
const API = (process.env.API_URL || 'https://web-hoc-stripe.onrender.com').replace(/\/$/, '');
const ORIGIN = process.env.CLIENT_ORIGIN || 'https://joymed.vercel.app';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, cors: res.headers.get('access-control-allow-origin'), body };
}

async function main() {
  console.log('API:', API);
  console.log('Origin:', ORIGIN);

  const health = await request('/health');
  if (!health.body.ok) throw new Error('Health failed');
  console.log('1. Health OK — clientUrl:', health.body.clientUrl);

  const products = await request('/api/products');
  if (!products.body.products?.length) throw new Error('No products');
  console.log('2. Products OK —', products.body.products.length, 'items, CORS:', products.cors || '(none)');

  const email = `prod_smoke_${Date.now()}@gmail.com`;
  const password = 'Test1234!';
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
  if (reg.status !== 201) throw new Error(`Register failed: ${JSON.stringify(reg.body)}`);
  console.log('3. Register OK —', email);

  console.log('\nProduction smoke passed.');
}

main().catch((err) => {
  console.error('Production smoke failed:', err.message);
  process.exit(1);
});
