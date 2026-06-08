/**
 * Smoke test: store products API + admin price override.
 * Usage: node scripts/test-product-pricing.js
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
  if (r.status !== 200) throw new Error(`Login failed: ${r.status}`);
  return r.body.token;
}

async function main() {
  console.log('=== Product pricing test ===\n');

  const products = await req('/api/products');
  if (products.status !== 200) throw new Error('GET /api/products failed');
  const energy = products.body.products.filter((p) => p.category === 'energy');
  const gold = products.body.products.filter((p) => p.category === 'gold');
  console.log('1. Public products:', products.body.products.length, `(energy: ${energy.length}, gold: ${gold.length})`);

  const adminToken = await login('admin@localhost', 'admin123456');
  const adminList = await req('/api/admin/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (adminList.status !== 200) throw new Error('GET /api/admin/products failed');
  const target = adminList.body.products.find((p) => p.product_key === 'energy_refill');
  if (!target) throw new Error('energy_refill not in admin list');
  console.log('2. Admin list has display_price:', target.display_price);

  const originalCents = target.amount_cents;
  const newCents = originalCents + 1;

  const patch = await req('/api/admin/products/energy_refill', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ amountCents: newCents }),
  });
  if (patch.status !== 200) {
    throw new Error(`PATCH failed: ${patch.status} ${JSON.stringify(patch.body)}`);
  }
  if (!patch.body.product.price_overridden) {
    throw new Error('Expected price_overridden after custom price');
  }
  console.log('3. Admin override OK:', patch.body.product.display_price);

  const after = await req('/api/products');
  const storeProduct = after.body.products.find((p) => p.key === 'energy_refill');
  if (storeProduct.amount !== newCents) {
    throw new Error(`Store amount mismatch: ${storeProduct.amount} vs ${newCents}`);
  }
  console.log('4. Store reflects new price:', storeProduct.displayPrice);

  const reset = await req('/api/admin/products/energy_refill', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ amountCents: null }),
  });
  if (reset.status !== 200) throw new Error('Reset price failed');
  if (reset.body.product.price_overridden) throw new Error('Expected price_overridden false after reset');
  console.log('5. Reset to default OK:', reset.body.product.display_price);

  console.log('\n=== ALL TESTS PASSED ===');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
