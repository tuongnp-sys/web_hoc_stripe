require('../src/config').validateConfig();
const { getPool } = require('../src/db/pool');

getPool()
  .query(
    `SELECT o.id, o.product_key, o.amount, o.status, o.stripe_checkout_session_id, o.created_at, u.email
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE u.email = 'c@gmail.com'
     ORDER BY o.created_at DESC`
  )
  .then(({ rows }) => {
    console.table(rows.map((r) => ({
      product: r.product_key,
      amount: r.amount / 100,
      status: r.status,
      session: r.stripe_checkout_session_id?.slice(0, 20),
      created: r.created_at,
    })));
    process.exit(0);
  });
