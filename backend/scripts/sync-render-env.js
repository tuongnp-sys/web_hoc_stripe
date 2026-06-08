/**
 * Push backend/.env values to Render (production). Requires RENDER_API_KEY.
 *
 * Usage:
 *   RENDER_API_KEY=rnd_... node scripts/sync-render-env.js
 *   # or add RENDER_API_KEY to backend/.env
 *
 * Get API key: https://dashboard.render.com/u/settings#api-keys
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API_KEY = (process.env.RENDER_API_KEY || '').trim();
const SERVICE_ID = (process.env.RENDER_SERVICE_ID || '').trim();
const SERVICE_NAME = (process.env.RENDER_SERVICE_NAME || 'web-hoc-stripe').trim();

const PRODUCTION_OVERRIDES = {
  NODE_ENV: 'production',
  CLIENT_URL: 'https://joymed.vercel.app',
  API_PUBLIC_URL: 'https://web-hoc-stripe.onrender.com',
  EXTRA_CORS_ORIGINS: 'https://joymed.vercel.app',
};

const SYNC_KEYS = [
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY_LIVE',
  'STRIPE_WEBHOOK_SECRET_LIVE',
  'STRIPE_LIVE_ALLOWED',
  'JWT_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'STRIPE_PRICE_GOLD_STARTER',
  'STRIPE_PRICE_GOLD_POPULAR',
  'STRIPE_PRICE_GOLD_PRO',
  'STRIPE_PRICE_GOLD_MEGA',
  'STRIPE_PRICE_PREMIUM_MONTHLY',
  'STRIPE_TAX_ENABLED',
  'ADMIN_SECRET',
  ...Object.keys(PRODUCTION_OVERRIDES),
];

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function renderFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === 'object' ? JSON.stringify(body) : body;
    throw new Error(`Render API ${res.status}: ${msg}`);
  }
  return body;
}

async function findServiceId() {
  if (SERVICE_ID) return SERVICE_ID;

  let cursor = null;
  for (;;) {
    const qs = new URLSearchParams({ limit: '100' });
    if (cursor) qs.set('cursor', cursor);
    const data = await renderFetch(`https://api.render.com/v1/services?${qs}`);
    for (const item of data) {
      const svc = item.service || item;
      const name = (svc.name || '').toLowerCase();
      const slug = (svc.slug || '').toLowerCase();
      if (
        name === SERVICE_NAME.toLowerCase() ||
        slug === SERVICE_NAME.toLowerCase() ||
        name.includes('stripe') ||
        slug.includes('web-hoc-stripe')
      ) {
        return svc.id;
      }
    }
    cursor = data.length ? data[data.length - 1]?.cursor : null;
    if (!cursor) break;
  }
  throw new Error(
    `Service not found. Set RENDER_SERVICE_ID or RENDER_SERVICE_NAME (tried "${SERVICE_NAME}").`
  );
}

async function main() {
  if (!API_KEY) {
    console.error('Missing RENDER_API_KEY.');
    console.error('Create one at https://dashboard.render.com/u/settings#api-keys');
    console.error('Then: RENDER_API_KEY=rnd_... node scripts/sync-render-env.js');
    process.exit(1);
  }

  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Missing backend/.env');
    process.exit(1);
  }

  const local = parseEnvFile(envPath);
  const payload = [];
  for (const key of SYNC_KEYS) {
    const value = PRODUCTION_OVERRIDES[key] ?? local[key];
    if (value) payload.push({ key, value });
  }

  const serviceId = await findServiceId();
  console.log(`[sync-render] Updating ${payload.length} env vars on service ${serviceId}...`);

  await renderFetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  console.log('[sync-render] Triggering deploy...');
  await renderFetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'clear' }),
  });

  console.log('[sync-render] Done. Verify:');
  console.log('  curl https://web-hoc-stripe.onrender.com/api/oauth/config');
}

main().catch((err) => {
  console.error('[sync-render]', err.message);
  process.exit(1);
});
