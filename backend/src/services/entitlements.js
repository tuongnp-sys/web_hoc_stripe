const { getPool } = require('../db/pool');

async function hasEntitlement(userId, featureKey = 'game_unlock') {
  const { rows } = await getPool().query(
    `SELECT 1 FROM entitlements
     WHERE user_id = $1 AND feature_key = $2 AND active = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId, featureKey]
  );
  return rows.length > 0;
}

async function grantEntitlement(userId, featureKey, sourceOrderId = null, expiresAt = null) {
  const { rows } = await getPool().query(
    `INSERT INTO entitlements (user_id, feature_key, active, source_order_id, expires_at)
     VALUES ($1, $2, TRUE, $3, $4)
     ON CONFLICT (user_id, feature_key)
     DO UPDATE SET
       active = TRUE,
       source_order_id = COALESCE(EXCLUDED.source_order_id, entitlements.source_order_id),
       expires_at = EXCLUDED.expires_at
     RETURNING *`,
    [userId, featureKey, sourceOrderId, expiresAt]
  );
  console.log(`[entitlement] granted ${featureKey} for user ${userId}`);
  return rows[0];
}

async function revokeEntitlement(userId, featureKey) {
  await getPool().query(
    `UPDATE entitlements SET active = FALSE WHERE user_id = $1 AND feature_key = $2`,
    [userId, featureKey]
  );
  console.log(`[entitlement] revoked ${featureKey} for user ${userId}`);
}

async function listForUser(userId) {
  const { rows } = await getPool().query(
    `SELECT feature_key, active, expires_at, created_at
     FROM entitlements WHERE user_id = $1`,
    [userId]
  );
  return rows;
}

module.exports = { hasEntitlement, grantEntitlement, revokeEntitlement, listForUser };
