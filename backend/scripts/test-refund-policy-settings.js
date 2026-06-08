/**
 * Test admin refund policy settings + public policy API.
 * Usage: node scripts/test-refund-policy-settings.js
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

function sectionBody(policy, heading) {
  return policy.sections.find((s) => s.heading === heading)?.body || '';
}

async function main() {
  console.log('=== Refund policy settings test ===\n');

  const publicPolicy = await req('/api/policy/refund');
  if (publicPolicy.status !== 200) throw new Error('GET /api/policy/refund failed');
  const body2 = sectionBody(publicPolicy.body.policy, '2. Eligibility Window');
  console.log('1. Public policy windowHours:', publicPolicy.body.policy.windowHours);
  if (!body2.includes('48 hours')) {
    console.log('   Note: default may differ if already customized:', body2.slice(0, 60));
  }

  const adminToken = await login('admin@localhost', 'admin123456');
  const adminGet = await req('/api/admin/settings/refund-policy', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (adminGet.status !== 200) throw new Error('Admin GET failed');
  console.log('2. Admin settings windowHours:', adminGet.body.windowHours);

  const patch24 = await req('/api/admin/settings/refund-policy', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ windowHours: 24 }),
  });
  if (patch24.status !== 200) {
    throw new Error(`PATCH 24h failed: ${patch24.status} ${JSON.stringify(patch24.body)}`);
  }
  const preview24 = sectionBody(patch24.body.policy, '2. Eligibility Window');
  if (!preview24.includes('24 hours')) {
    throw new Error(`Expected 24 hours in preview: ${preview24}`);
  }
  console.log('3. PATCH 24h OK');

  const afterPublic = await req('/api/policy/refund');
  const public24 = sectionBody(afterPublic.body.policy, '2. Eligibility Window');
  if (!public24.includes('24 hours')) {
    throw new Error(`Public policy not updated: ${public24}`);
  }
  console.log('4. Public policy reflects 24h');

  const reset = await req('/api/admin/settings/refund-policy', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ windowHours: 48 }),
  });
  if (reset.status !== 200) throw new Error('Reset to 48h failed');
  console.log('5. Reset to 48h OK');

  const bad = await req('/api/admin/settings/refund-policy', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ windowHours: 999 }),
  });
  if (bad.status !== 400) throw new Error('Expected 400 for invalid windowHours');
  console.log('6. Validation rejects 999h OK');

  console.log('\n=== ALL TESTS PASSED ===');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
