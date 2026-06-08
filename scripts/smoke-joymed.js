/**
 * Smoke test: game API routes + product catalog includes energy packs.
 * Usage: node scripts/smoke-joymed.js [API_BASE]
 */
const API_BASE = process.argv[2] || 'http://localhost:3000';

async function check(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function main() {
  const health = await check('/health');
  if (health.status !== 200) {
    console.error('FAIL health', health);
    process.exit(1);
  }
  console.log('OK /health');

  const products = await check('/api/products');
  const keys = (products.data?.products || []).map((p) => p.key);
  for (const key of ['energy_refill', 'energy_pack_5', 'gold_starter', 'premium_monthly']) {
    if (!keys.includes(key)) {
      console.error(`FAIL missing product ${key}`);
      process.exit(1);
    }
  }
  console.log('OK /api/products includes energy + gold + vip');

  const lb = await check('/api/game/leaderboard?limit=5');
  if (lb.status !== 200 || !Array.isArray(lb.data?.entries)) {
    console.error('FAIL leaderboard', lb);
    process.exit(1);
  }
  console.log('OK /api/game/leaderboard');

  const profile = await check('/api/game/profile');
  if (profile.status !== 401) {
    console.error('FAIL profile should require auth', profile.status);
    process.exit(1);
  }
  console.log('OK /api/game/profile requires JWT');

  console.log('smoke-joymed: all checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
