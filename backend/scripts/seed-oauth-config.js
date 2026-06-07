/**
 * Store OAuth credentials in Neon runtime_config (fallback when Render env is missing).
 * Env vars on the server always take precedence over DB values.
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { validateConfig } = require('../src/config');
const { migrate } = require('../src/db/migrate');
const runtimeConfig = require('../src/services/runtimeConfig');

async function main() {
  validateConfig();
  await migrate();

  const entries = {};
  for (const key of runtimeConfig.OAUTH_KEYS) {
    const value = (process.env[key] || '').trim();
    if (value) entries[key] = value;
  }

  if (!entries.GOOGLE_CLIENT_ID && !entries.DISCORD_CLIENT_ID) {
    console.error('No OAuth keys in backend/.env — set GOOGLE_* and DISCORD_* first.');
    process.exit(1);
  }

  await runtimeConfig.upsertMany(entries);
  console.log('[seed-oauth] Stored keys:', Object.keys(entries).join(', '));
}

main().catch((err) => {
  console.error('[seed-oauth]', err.message);
  process.exit(1);
});
