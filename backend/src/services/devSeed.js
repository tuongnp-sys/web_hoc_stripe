const bcrypt = require('bcryptjs');
const { config } = require('../config');
const users = require('./users');
const wallet = require('./wallet');
const { getPool } = require('../db/pool');

const DEV_ADMIN_EMAIL = 'admin@localhost';
const DEV_ADMIN_PASSWORD = 'admin123456';

async function ensureDevAdmin() {
  if (config.nodeEnv !== 'development') return null;

  const existing = await users.findByEmail(DEV_ADMIN_EMAIL);
  if (existing) {
    await getPool().query(
      `UPDATE users SET email_verified = TRUE, role = 'admin', is_root = TRUE,
              admin_scope = 'full', account_status = 'active' WHERE id = $1`,
      [existing.id]
    );
    return existing;
  }

  const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 10);
  const { rows } = await getPool().query(
    `INSERT INTO users (email, password_hash, email_verified, role, is_root, admin_scope, account_status, terms_accepted_at, age_confirmed_at)
     VALUES ($1, $2, TRUE, 'admin', TRUE, 'full', 'active', NOW(), NOW())
     RETURNING id, email`,
    [DEV_ADMIN_EMAIL, passwordHash]
  );
  await wallet.ensureWallet(rows[0].id);
  console.log(`[dev] Seeded test account: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);
  return rows[0];
}

module.exports = { ensureDevAdmin, DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD };
