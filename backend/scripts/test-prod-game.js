/**
 * Production game API + Vercel proxy smoke test.
 * Usage: node scripts/test-prod-game.js
 */
const API = (process.env.API_URL || 'https://web-hoc-stripe.onrender.com').replace(/\/$/, '');
const CLIENT = (process.env.CLIENT_ORIGIN || 'https://joymed.vercel.app').replace(/\/$/, '');

async function req(base, path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', Origin: CLIENT, ...extraHeaders },
    ...rest,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, cors: res.headers.get('access-control-allow-origin') };
}

async function login(email, password) {
  const r = await req(API, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (r.status !== 200) throw new Error(`Login failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token;
}

async function main() {
  console.log('=== Production game API test ===');
  console.log('API:', API);
  console.log('Client:', CLIENT, '\n');

  const token = await login('admin@localhost', 'admin123456');
  console.log('1. Login OK');

  const profile = await req(API, '/api/game/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (profile.status !== 200) throw new Error(`Profile failed: ${profile.status}`);
  const { energy, goldBalance, isVip } = profile.body;
  console.log('2. Game profile OK — energy:', energy, 'gold:', goldBalance, 'vip:', isVip);

  const start = await req(API, '/api/game/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  if (start.status !== 200) throw new Error(`Game start failed: ${start.status}`);
  if (!start.body.allowed && !isVip && energy <= 0) {
    console.log('3. Game start blocked (no energy) — expected when energy is 0');
  } else if (!start.body.allowed) {
    throw new Error(`Game start not allowed: ${JSON.stringify(start.body)}`);
  } else {
    console.log('3. Game start OK — allowed:', start.body.allowed);
  }

  const proxyProfile = await req(CLIENT, '/api/game/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (proxyProfile.status !== 200) {
    throw new Error(
      `Vercel /api proxy failed: ${proxyProfile.status} (deploy vercel.json rewrites first)`
    );
  }
  if (typeof proxyProfile.body.energy !== 'number') {
    throw new Error('Vercel proxy returned invalid profile JSON');
  }
  console.log('4. Vercel /api proxy OK — energy:', proxyProfile.body.energy);

  const shellUrl = `${CLIENT}/game/shell.html?apiBase=${encodeURIComponent(API)}`;
  const shell = await fetch(shellUrl, { headers: { Accept: 'text/html' } });
  if (shell.status !== 200) throw new Error(`Game shell failed: ${shell.status}`);
  const html = await shell.text();
  if (!html.includes('shell') && !html.includes('Joymed') && !html.includes('game')) {
    console.warn('WARN: shell HTML may be unexpected SPA fallback');
  }
  console.log('5. Game shell HTML OK:', shell.status);

  console.log('\n=== ALL PROD GAME TESTS PASSED ===');
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
