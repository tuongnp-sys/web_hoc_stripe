const { getPool } = require('../db/pool');
const entitlements = require('./entitlements');
const wallet = require('./wallet');
const audit = require('./adminAudit');

async function listUsers({ search = '', limit = 50, offset = 0 } = {}) {
  const params = [];
  let where = '';
  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    where = `WHERE LOWER(u.email) LIKE $${params.length}`;
  }
  params.push(limit, offset);

  const { rows } = await getPool().query(
    `SELECT u.id, u.email, u.role, u.email_verified, u.oauth_provider, u.created_at,
            COALESCE(w.gold_balance, 0) AS gold_balance
     FROM users u
     LEFT JOIN wallets w ON w.user_id = u.id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = search.trim() ? [`%${search.trim().toLowerCase()}%`] : [];
  const countWhere = search.trim() ? 'WHERE LOWER(email) LIKE $1' : '';
  const { rows: countRows } = await getPool().query(
    `SELECT COUNT(*)::int AS total FROM users ${countWhere}`,
    countParams
  );

  return { users: rows, total: countRows[0].total };
}

async function getUserDetail(userId) {
  const { rows } = await getPool().query(
    `SELECT id, email, role, email_verified, oauth_provider, stripe_customer_id, created_at
     FROM users WHERE id = $1`,
    [userId]
  );
  if (!rows[0]) return null;

  const [goldBalance, entList, orderRows] = await Promise.all([
    wallet.getBalance(userId),
    entitlements.listForUser(userId),
    getPool().query(
      `SELECT id, product_key, amount, currency, status, mode, gold_amount, gold_unspent,
              access_enabled, admin_note, description, created_at, paid_at
       FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [userId]
    ),
  ]);

  return {
    user: rows[0],
    goldBalance,
    entitlements: entList,
    orders: orderRows.rows,
  };
}

async function updateUser(adminId, userId, { emailVerified, role }) {
  const fields = [];
  const values = [];
  let i = 1;

  if (emailVerified !== undefined) {
    fields.push(`email_verified = $${i++}`);
    values.push(Boolean(emailVerified));
  }
  if (role !== undefined) {
    if (!['user', 'admin'].includes(role)) {
      const err = new Error('Invalid role');
      err.status = 400;
      throw err;
    }
    if (String(adminId) === String(userId) && role !== 'admin') {
      const err = new Error('Cannot remove your own admin role');
      err.status = 400;
      throw err;
    }
    fields.push(`role = $${i++}`);
    values.push(role);
  }

  if (!fields.length) {
    const err = new Error('No fields to update');
    err.status = 400;
    throw err;
  }

  values.push(userId);
  const { rows } = await getPool().query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, email, role, email_verified, oauth_provider, created_at`,
    values
  );
  if (!rows[0]) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  await audit.logAction(adminId, 'user.update', 'user', userId, { emailVerified, role });
  return rows[0];
}

async function deleteUser(adminId, userId) {
  if (String(adminId) === String(userId)) {
    const err = new Error('Cannot delete your own account');
    err.status = 400;
    throw err;
  }

  const { rows: admins } = await getPool().query(
    `SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND id != $1`,
    [userId]
  );
  const target = await getPool().query('SELECT email, role FROM users WHERE id = $1', [userId]);
  if (!target.rows[0]) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (target.rows[0].role === 'admin' && admins.rows[0].count === 0) {
    const err = new Error('Cannot delete the last admin account');
    err.status = 400;
    throw err;
  }

  await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
  await audit.logAction(adminId, 'user.delete', 'user', userId, { email: target.rows[0].email });
  return { deleted: true };
}

async function setEntitlement(adminId, userId, featureKey, { active, adminNote }) {
  if (!['premium', 'game_unlock'].includes(featureKey)) {
    const err = new Error('Invalid feature key');
    err.status = 400;
    throw err;
  }

  if (active) {
    await entitlements.grantEntitlement(userId, featureKey, null, null);
    if (adminNote) {
      await getPool().query(
        `UPDATE entitlements SET admin_note = $3, updated_at = NOW() WHERE user_id = $1 AND feature_key = $2`,
        [userId, featureKey, adminNote]
      );
    }
  } else {
    await entitlements.revokeEntitlement(userId, featureKey);
    if (adminNote) {
      await getPool().query(
        `UPDATE entitlements SET admin_note = $3, updated_at = NOW() WHERE user_id = $1 AND feature_key = $2`,
        [userId, featureKey, adminNote]
      );
    }
  }

  await audit.logAction(adminId, 'entitlement.set', 'entitlement', `${userId}:${featureKey}`, {
    active,
    adminNote,
  });

  return entitlements.listForUser(userId);
}

async function setOrderAccess(adminId, orderId, { accessEnabled, adminNote }) {
  const { rows } = await getPool().query(
    `UPDATE orders SET access_enabled = $2, admin_note = COALESCE($3, admin_note)
     WHERE id = $1 AND status = 'paid'
     RETURNING id, user_id, product_key, access_enabled, admin_note`,
    [orderId, Boolean(accessEnabled), adminNote ?? null]
  );
  if (!rows[0]) {
    const err = new Error('Paid order not found');
    err.status = 404;
    throw err;
  }

  await audit.logAction(adminId, 'order.access', 'order', orderId, {
    accessEnabled,
    adminNote,
    productKey: rows[0].product_key,
  });

  return rows[0];
}

async function adjustGold(adminId, userId, amount, note) {
  const delta = Number(amount);
  if (!Number.isInteger(delta) || delta === 0) {
    const err = new Error('Amount must be a non-zero integer');
    err.status = 400;
    throw err;
  }

  if (delta > 0) {
    await wallet.creditGold(userId, delta, null, note || 'Admin adjustment');
  } else {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await wallet.ensureWallet(userId, client);
      const { rows } = await client.query(
        'SELECT gold_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      const balance = rows[0]?.gold_balance ?? 0;
      const debit = Math.min(balance, Math.abs(delta));
      if (debit > 0) {
        const balanceAfter = balance - debit;
        await client.query(
          'UPDATE wallets SET gold_balance = $2, updated_at = NOW() WHERE user_id = $1',
          [userId, balanceAfter]
        );
        await client.query(
          `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description)
           VALUES ($1, 'admin_debit', $2, $3, $4)`,
          [userId, debit, balanceAfter, note || 'Admin adjustment']
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  const newBalance = await wallet.getBalance(userId);
  await audit.logAction(adminId, 'wallet.adjust', 'user', userId, { amount: delta, note, newBalance });
  return { goldBalance: newBalance };
}

async function listProducts() {
  const { rows } = await getPool().query(
    `SELECT product_key, name, mode, enabled, updated_at FROM product_catalog ORDER BY product_key`
  );
  return rows;
}

async function setProductEnabled(adminId, productKey, enabled) {
  const { rows } = await getPool().query(
    `UPDATE product_catalog SET enabled = $2, updated_at = NOW()
     WHERE product_key = $1 RETURNING *`,
    [productKey, Boolean(enabled)]
  );
  if (!rows[0]) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  await audit.logAction(adminId, 'product.toggle', 'product', productKey, { enabled });
  return rows[0];
}

module.exports = {
  listUsers,
  getUserDetail,
  updateUser,
  deleteUser,
  setEntitlement,
  setOrderAccess,
  adjustGold,
  listProducts,
  setProductEnabled,
};
