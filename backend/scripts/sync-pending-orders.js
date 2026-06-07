/**
 * Sync all pending orders against Stripe Checkout session status.
 * Usage: node scripts/sync-pending-orders.js
 */
require('../src/config').validateConfig();
const { getPool } = require('../src/db/pool');
const { syncPendingOrdersForUser } = require('../src/services/webhookHandler');

(async () => {
  const { rows } = await getPool().query(
    `SELECT DISTINCT user_id FROM orders WHERE status = 'pending'`
  );

  let totalSynced = 0;
  for (const row of rows) {
    const result = await syncPendingOrdersForUser(row.user_id);
    console.log(`User ${row.user_id}: synced ${result.synced}/${result.checked}`);
    totalSynced += result.synced;
  }

  console.log(`\nDone. Total synced: ${totalSynced}`);
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
