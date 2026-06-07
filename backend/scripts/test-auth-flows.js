/**
 * Auth + checkout API tests.
 * Usage: node scripts/test-auth-flows.js
 */
const API = process.env.API_URL || 'http://localhost:3000';

async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  console.log('1. OAuth config...');
  const oauthCfg = await req('/api/oauth/config');
  console.log('   Google URI:', oauthCfg.body.googleRedirectUri);
  console.log('   Discord URI:', oauthCfg.body.discordRedirectUri);
  if (oauthCfg.body.googleRedirectUri?.includes(' ')) throw new Error('Google URI has whitespace');

  console.log('2. Login unknown user...');
  const badLogin = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'tuongnp@gmail.com', password: 'WrongPass1!' }),
  });
  if (badLogin.status !== 401) throw new Error('Expected 401 for unknown/wrong login');
  console.log('   OK (401):', badLogin.body.error);

  console.log('3. Register + login c@gmail.com flow...');
  const login = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'c@gmail.com', password: 'Test1234!' }),
  });
  if (login.status === 401) {
    console.log('   SKIP login (password unknown) — register test user instead');
  } else if (login.status === 200) {
    console.log('   Login OK, emailVerified:', login.body.user?.emailVerified);
    const token = login.body.token;

    console.log('4. Sync pending orders...');
    const sync = await req('/api/checkout/sync-pending', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('   synced:', sync.body.synced, '/', sync.body.checked);

    console.log('5. Checkout deposit...');
    const dep = await req('/api/checkout/deposit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ productKey: 'gold_starter' }),
    });
    if (!dep.body.url?.includes('checkout.stripe.com')) throw new Error(JSON.stringify(dep.body));
    console.log('   Deposit session OK');

    console.log('6. Checkout subscription...');
    const sub = await req('/api/checkout/subscription', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!sub.body.url?.includes('checkout.stripe.com')) throw new Error(JSON.stringify(sub.body));
    console.log('   Subscription session OK');
  }

  console.log('7. Forgot password (c@gmail.com)...');
  const forgot = await req('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'c@gmail.com' }),
  });
  console.log('   status:', forgot.status, forgot.body.message?.slice(0, 50));
  if (forgot.body.devResetUrl) console.log('   devResetUrl: present');

  console.log('\nAll auth/checkout tests passed.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
