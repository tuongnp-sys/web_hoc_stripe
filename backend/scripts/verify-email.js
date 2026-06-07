/**
 * Manually verify a user's email.
 * Usage: node scripts/verify-email.js c@gmail.com
 */
require('../src/config').validateConfig();
const { getPool } = require('../src/db/pool');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/verify-email.js <email>');
  process.exit(1);
}

getPool()
  .query(
    'UPDATE users SET email_verified = TRUE WHERE email = $1 RETURNING id, email, email_verified',
    [email.toLowerCase()]
  )
  .then(({ rows }) => {
    if (!rows[0]) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }
    console.log('Updated:', rows[0]);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
