const { getPool } = require('../db/pool');

const OAUTH_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
];

async function getMany(keys) {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT key, value FROM runtime_config WHERE key = ANY($1::text[])',
    [keys]
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function upsertMany(entries) {
  const pool = getPool();
  for (const [key, value] of Object.entries(entries)) {
    if (value == null || value === '') continue;
    await pool.query(
      `INSERT INTO runtime_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    );
  }
}

module.exports = { OAUTH_KEYS, getMany, upsertMany };
