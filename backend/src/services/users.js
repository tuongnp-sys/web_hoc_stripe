const bcrypt = require('bcryptjs');
const { getPool } = require('../db/pool');
const wallet = require('./wallet');

const PUBLIC_FIELDS =
  'id, email, stripe_customer_id, email_verified, terms_accepted_at, age_confirmed_at, oauth_provider, role, created_at';

async function findByEmail(email) {
  const { rows } = await getPool().query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await getPool().query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findByOAuth(provider, oauthId) {
  const { rows } = await getPool().query(
    'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
    [provider, oauthId]
  );
  return rows[0] || null;
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.email_verified ?? false,
    termsAcceptedAt: user.terms_accepted_at,
    ageConfirmedAt: user.age_confirmed_at,
    oauthProvider: user.oauth_provider,
    role: user.role || 'user',
    createdAt: user.created_at,
  };
}

async function createUser(email, password, { termsAccepted, ageConfirmed } = {}) {
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await getPool().query(
    `INSERT INTO users (email, password_hash, terms_accepted_at, age_confirmed_at)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_FIELDS}`,
    [
      email.toLowerCase(),
      passwordHash,
      termsAccepted ? new Date() : null,
      ageConfirmed ? new Date() : null,
    ]
  );
  await wallet.ensureWallet(rows[0].id);
  return rows[0];
}

async function createOAuthUser(email, provider, oauthId, { termsAccepted, ageConfirmed } = {}) {
  const { rows } = await getPool().query(
    `INSERT INTO users (email, oauth_provider, oauth_id, email_verified, terms_accepted_at, age_confirmed_at)
     VALUES ($1, $2, $3, TRUE, $4, $5)
     RETURNING ${PUBLIC_FIELDS}`,
    [
      email.toLowerCase(),
      provider,
      oauthId,
      termsAccepted ? new Date() : null,
      ageConfirmed ? new Date() : null,
    ]
  );
  await wallet.ensureWallet(rows[0].id);
  return rows[0];
}

async function linkOAuth(userId, provider, oauthId) {
  await getPool().query(
    'UPDATE users SET oauth_provider = $2, oauth_id = $3, email_verified = TRUE WHERE id = $1',
    [userId, provider, oauthId]
  );
}

async function verifyPassword(user, password) {
  if (!user.password_hash) return false;
  return bcrypt.compare(password, user.password_hash);
}

async function setStripeCustomerId(userId, stripeCustomerId) {
  await getPool().query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [
    stripeCustomerId,
    userId,
  ]);
}

async function clearStripeCustomerId(userId) {
  await getPool().query('UPDATE users SET stripe_customer_id = NULL WHERE id = $1', [userId]);
}

async function setEmailVerified(userId) {
  await getPool().query('UPDATE users SET email_verified = TRUE WHERE id = $1', [userId]);
}

async function updateEmail(userId, email) {
  const { rows } = await getPool().query(
    `UPDATE users SET email = $2, email_verified = FALSE WHERE id = $1 RETURNING ${PUBLIC_FIELDS}`,
    [userId, email.toLowerCase()]
  );
  return rows[0] || null;
}

async function updatePassword(userId, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  await getPool().query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
}

async function createVerificationToken(userId, token, expiresAt) {
  await getPool().query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
  await getPool().query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
}

async function consumeVerificationToken(token) {
  const { rows } = await getPool().query(
    `DELETE FROM email_verification_tokens
     WHERE token = $1 AND expires_at > NOW()
     RETURNING user_id`,
    [token]
  );
  if (!rows[0]) return null;
  await setEmailVerified(rows[0].user_id);
  return rows[0].user_id;
}

async function createPasswordResetToken(userId, token, expiresAt) {
  await getPool().query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
  await getPool().query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
}

async function consumePasswordResetToken(token) {
  const { rows } = await getPool().query(
    `SELECT * FROM password_reset_tokens
     WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
    [token]
  );
  return rows[0] || null;
}

async function markPasswordResetUsed(tokenId) {
  await getPool().query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);
}

module.exports = {
  findByEmail,
  findById,
  findByOAuth,
  toPublicUser,
  createUser,
  createOAuthUser,
  linkOAuth,
  verifyPassword,
  setStripeCustomerId,
  clearStripeCustomerId,
  setEmailVerified,
  updateEmail,
  updatePassword,
  createVerificationToken,
  consumeVerificationToken,
  createPasswordResetToken,
  consumePasswordResetToken,
  markPasswordResetUsed,
};
