const bcrypt = require('bcryptjs');
const { getPool } = require('../db/pool');

async function findByEmail(email) {
  const { rows } = await getPool().query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await getPool().query(
    'SELECT id, email, stripe_customer_id, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function createUser(email, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await getPool().query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email.toLowerCase(), passwordHash]
  );
  return rows[0];
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

async function setStripeCustomerId(userId, stripeCustomerId) {
  await getPool().query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [
    stripeCustomerId,
    userId,
  ]);
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  verifyPassword,
  setStripeCustomerId,
};
