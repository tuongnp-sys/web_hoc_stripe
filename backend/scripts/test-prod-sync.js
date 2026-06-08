/**
 * Production sync check: joymed.vercel.app + Render API alignment.
 * Usage: node scripts/test-prod-sync.js
 */
const API = (process.env.API_URL || 'https://web-hoc-stripe.onrender.com').replace(/\/$/, '');
const CLIENT = (process.env.CLIENT_ORIGIN || 'https://joymed.vercel.app').replace(/\/$/, '');

async function req(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Origin: CLIENT, ...extraHeaders },
    ...rest,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, cors: res.headers.get('access-control-allow-origin') };
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
  console.log('=== Production sync test ===');
  console.log('API:', API);
  console.log('Client:', CLIENT, '\n');

  const home = await fetch(CLIENT + '/');
  if (home.status !== 200) throw new Error(`Frontend ${CLIENT} status ${home.status}`);
  const html = await home.text();
  if (!html.includes('Joymed') && !html.includes('joymed')) {
    console.warn('WARN: homepage HTML may be cached SPA shell only');
  }
  console.log('1. Frontend OK:', home.status);

  const health = await req('/health');
  if (health.status !== 200) throw new Error('Health failed');
  if (health.body.clientUrl !== CLIENT) {
    throw new Error(`CLIENT_URL mismatch: ${health.body.clientUrl} !== ${CLIENT}`);
  }
  console.log('2. Render CLIENT_URL OK:', health.body.clientUrl);

  const products = await req('/api/products');
  if (products.status !== 200 || products.cors !== CLIENT) {
    throw new Error(`Products/CORS issue: ${products.status} cors=${products.cors}`);
  }
  const cats = { energy: 0, gold: 0, vip: 0 };
  for (const p of products.body.products || []) {
    if (p.category === 'energy') cats.energy++;
    if (p.category === 'gold') cats.gold++;
    if (p.key === 'premium_monthly') cats.vip++;
  }
  console.log('3. Products OK:', products.body.products.length, cats);

  const policy = await req('/api/policy/refund');
  if (policy.status !== 200) throw new Error('Policy API failed');
  const hours = policy.body.policy?.windowHours;
  const s2 = (policy.body.policy?.sections || []).find((s) => s.heading?.includes('Eligibility'));
  if (!s2?.body?.includes(String(hours))) {
    throw new Error('Policy section 2 does not match windowHours');
  }
  console.log('4. Refund policy OK — windowHours:', hours);

  const adminToken = await login('admin@localhost', 'admin123456');
  const settings = await req('/api/admin/settings/refund-policy', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (settings.status !== 200) throw new Error('Admin settings GET failed');
  console.log('5. Admin settings OK — windowHours:', settings.body.windowHours);

  if (hours !== settings.body.windowHours) {
    throw new Error('Public policy and admin settings windowHours differ');
  }

  if (hours < 24) {
    console.log('6. Resetting refund window to 48h on production...');
    const patch = await req('/api/admin/settings/refund-policy', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ windowHours: 48 }),
    });
    if (patch.status !== 200) throw new Error('Failed to reset windowHours to 48');
    console.log('   Reset OK');
  } else {
    console.log('6. Refund window acceptable:', hours, 'h (skip reset)');
  }

  const gameProfile = await req('/api/game/profile', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (gameProfile.status !== 200) throw new Error('Game profile failed');
  console.log('7. Game profile OK — energy:', gameProfile.body.energy);

  const gameStart = await req('/api/game/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({}),
  });
  if (gameStart.status !== 200) throw new Error('Game start failed');
  console.log('8. Game start OK — allowed:', gameStart.body.allowed);

  const proxyHealth = await fetch(`${CLIENT}/health`);
  if (proxyHealth.status !== 200) {
    console.warn('WARN: Vercel /health proxy not ready (deploy vercel.json)');
  } else {
    const proxyBody = await proxyHealth.json().catch(() => ({}));
    console.log('9. Vercel /health proxy OK — clientUrl:', proxyBody.clientUrl);
  }

  console.log('\n=== ALL PROD SYNC TESTS PASSED ===');
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
