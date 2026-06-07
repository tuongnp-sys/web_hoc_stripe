/**
 * Auth diagnostics for an email.
 * Usage: node scripts/check-user.js tuongnp@gmail.com
 */
require('../src/config').validateConfig();
const { getPool } = require('../src/db/pool');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/check-user.js <email>');
  process.exit(1);
}

getPool()
  .query('SELECT id, email, email_verified, oauth_provider, password_hash IS NOT NULL AS has_password FROM users WHERE email = $1', [
    email.toLowerCase(),
  ])
  .then(({ rows }) => {
    if (!rows[0]) {
      console.log('User not found:', email);
      process.exit(0);
    }
    console.log(rows[0]);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
