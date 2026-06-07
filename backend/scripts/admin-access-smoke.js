/**
 * Smoke test admin RBAC invariants (local API must be running).
 * Usage: node scripts/admin-access-smoke.js
 */
const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');

async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Login ${email}: non-JSON ${res.status} from ${API}/api/auth/login - ${text.slice(0, 80)}`);
  }
  if (!res.ok) throw new Error(`Login ${email}: ${data.error}`);
  return data.token;
}

async function parseJson(res, label) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: non-JSON ${res.status} - ${text.slice(0, 80)}`);
  }
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson(res, `GET ${path}`);
  return { status: res.status, data };
}

async function patch(path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res, `PATCH ${path}`);
  return { status: res.status, data };
}

async function post(path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res, `POST ${path}`);
  return { status: res.status, data };
}

async function main() {
  console.log('Admin RBAC smoke @', API);

  const rootToken = await login('admin@localhost', 'admin123456');
  const session = await get('/api/admin/session', rootToken);
  if (session.data.actor?.scope !== 'full' || !session.data.actor?.isRoot) {
    throw new Error('Root admin session invalid');
  }
  console.log('1. Root session OK - scope full, isRoot');

  const users = await get('/api/admin/users?limit=5', rootToken);
  const root = users.data.users?.find((u) => u.email === 'admin@localhost');
  if (!root) throw new Error('Root user not in list');
  console.log('2. Users list OK');

  const demote = await patch(`/api/admin/users/${root.id}`, rootToken, { role: 'user' });
  if (demote.status !== 400) throw new Error('Expected block demote root');
  console.log('3. Block demote root OK');

  const suspend = await patch(`/api/admin/users/${root.id}`, rootToken, { accountStatus: 'suspended' });
  if (suspend.status !== 400) throw new Error('Expected block suspend root');
  console.log('4. Block suspend root OK');

  const testEmail = `smoke-view-${Date.now()}@localhost`;
  const created = await post('/api/admin/users', rootToken, {
    email: testEmail,
    password: 'SmokeTest1!Aa',
    role: 'user',
    emailVerified: true,
  });
  if (created.status !== 201) throw new Error('Expected create test user');
  const testUser = created.data.user;
  const suspendedUser = await patch(`/api/admin/users/${testUser.id}`, rootToken, {
    accountStatus: 'suspended',
  });
  if (suspendedUser.status !== 200) throw new Error('Expected suspend test user');
  const blockedLogin = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'SmokeTest1!Aa' }),
  });
  const blockedBody = await parseJson(blockedLogin, 'login suspended');
  if (blockedLogin.status !== 403 || blockedBody.code !== 'ACCOUNT_SUSPENDED') {
    throw new Error('Expected suspended login block');
  }
  console.log('5. Suspended user login blocked OK');

  const testEmail2 = `smoke-session-${Date.now()}@localhost`;
  const created2 = await post('/api/admin/users', rootToken, {
    email: testEmail2,
    password: 'SmokeTest1!Aa',
    role: 'user',
    emailVerified: true,
  });
  if (created2.status !== 201) throw new Error('Expected create session test user');
  const sessionUser = created2.data.user;
  const sessionToken = await login(testEmail2, 'SmokeTest1!Aa');
  const suspendedSessionUser = await patch(`/api/admin/users/${sessionUser.id}`, rootToken, {
    accountStatus: 'suspended',
  });
  if (suspendedSessionUser.status !== 200) throw new Error('Expected suspend session test user');
  const blockedMe = await get('/api/auth/me', sessionToken);
  if (blockedMe.status !== 403 || blockedMe.data.code !== 'ACCOUNT_SUSPENDED') {
    throw new Error('Expected suspended session block on GET /me');
  }
  console.log('6. Existing JWT blocked after suspend OK');

  await fetch(`${API}/api/admin/users/${sessionUser.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${rootToken}` },
  });

  await fetch(`${API}/api/admin/users/${testUser.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${rootToken}` },
  });

  console.log('Admin RBAC smoke passed.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
