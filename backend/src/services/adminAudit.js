const { getPool } = require('../db/pool');

async function logAction(adminUserId, action, targetType, targetId, details = null) {
  await getPool().query(
    `INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminUserId, action, targetType, targetId, details ? JSON.stringify(details) : null]
  );
}

async function listRecent(limit = 50) {
  const { rows } = await getPool().query(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.details, a.created_at,
            u.email AS admin_email
     FROM admin_audit_log a
     LEFT JOIN users u ON u.id = a.admin_user_id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = { logAction, listRecent };
