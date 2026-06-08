const bcrypt = require('bcryptjs');
const { getPool } = require('../db/pool');
const entitlements = require('./entitlements');
const wallet = require('./wallet');
const audit = require('./adminAudit');
const users = require('./users');
const { validatePassword, validateEmail } = require('../utils/validation');
const adminAccess = require('./adminAccess');
const { ROOT_ADMIN_EMAIL } = require('../constants/adminAccess');

const USER_FIELDS =
  'id, email, role, email_verified, oauth_provider, is_root, account_status, admin_scope, internal_note, stripe_customer_id, created_at';

async function listUsers({ search = '', limit = 50, offset = 0, actor = null } = {}) {
  const params = [];
  let where = '';
  if (search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    where = `WHERE LOWER(u.email) LIKE $${params.length}`;
  }
  params.push(limit, offset);

  const { rows } = await getPool().query(
    `SELECT u.id, u.email, u.role, u.email_verified, u.oauth_provider, u.is_root,
            u.account_status, u.admin_scope, u.created_at,
            COALESCE(w.gold_balance, 0) AS gold_balance,
            COALESCE((
              SELECT COUNT(*)::int FROM refund_requests rr
              WHERE rr.user_id = u.id AND rr.status = 'pending'
            ), 0) AS pending_refund_count
     FROM users u
     LEFT JOIN wallets w ON w.user_id = u.id
     ${where}
     ORDER BY u.is_root DESC, u.role DESC, u.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = search.trim() ? [`%${search.trim().toLowerCase()}%`] : [];
  const countWhere = search.trim() ? 'WHERE LOWER(email) LIKE $1' : '';
  const { rows: countRows } = await getPool().query(
    `SELECT COUNT(*)::int AS total FROM users ${countWhere}`,
    countParams
  );

  return {
    users: rows,
    total: countRows[0].total,
    session: actor ? adminAccess.buildSession(actor) : null,
  };
}

async function getUserDetail(userId, actor = null) {
  const { rows } = await getPool().query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1`, [userId]);
  if (!rows[0]) return null;

  const [goldBalance, entList, orderRows, actions] = await Promise.all([
    wallet.getBalance(userId),
    entitlements.listForUser(userId),
    getPool().query(
      `SELECT o.id, o.product_key, o.amount, o.currency, o.status, o.mode, o.gold_amount,
              o.gold_unspent, o.access_enabled, o.admin_note, o.description, o.created_at, o.paid_at,
              r.id AS refund_request_id, r.status AS refund_request_status,
              r.reason AS refund_reason, r.reason_detail, r.created_at AS refund_requested_at
       FROM orders o
       LEFT JOIN refund_requests r ON r.order_id = o.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [userId]
    ),
    actor ? adminAccess.buildTargetActions(actor.id, rows[0]) : null,
  ]);

  return {
    user: rows[0],
    goldBalance,
    entitlements: entList,
    orders: orderRows.rows,
    actions,
    session: actor ? adminAccess.buildSession(actor) : null,
  };
}

async function createUser(actor, { email, password, role = 'user', emailVerified = false, adminScope = 'view' }) {
  adminAccess.assertMinScope(actor, 'full', 'Only full-scope admins can create users');

  const emailErr = validateEmail(email, { allowDevLocal: true });
  if (emailErr) {
    const err = new Error(emailErr);
    err.status = 400;
    throw err;
  }

  const normalized = email.toLowerCase().trim();
  if (normalized === ROOT_ADMIN_EMAIL) {
    const err = new Error('This email is reserved for the root admin');
    err.status = 400;
    throw err;
  }

  const pwdErr = validatePassword(password);
  if (pwdErr) {
    const err = new Error(pwdErr);
    err.status = 400;
    throw err;
  }

  if (!['user', 'admin'].includes(role)) {
    const err = new Error('Invalid role');
    err.status = 400;
    throw err;
  }

  const existing = await users.findByEmail(normalized);
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  let scope = 'none';
  if (role === 'admin') {
    await adminAccess.assertCanChangeScope({ role: 'admin', is_root: false }, adminScope);
    scope = adminScope === 'none' ? 'view' : adminScope;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await getPool().query(
    `INSERT INTO users (email, password_hash, email_verified, role, admin_scope, account_status, terms_accepted_at, age_confirmed_at)
     VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
     RETURNING ${USER_FIELDS}`,
    [normalized, passwordHash, Boolean(emailVerified), role, scope]
  );
  await wallet.ensureWallet(rows[0].id);

  await audit.logAction(actor.id, 'user.create', 'user', rows[0].id, {
    email: rows[0].email,
    role,
    adminScope: scope,
  });
  return rows[0];
}

async function updateUser(actor, userId, body) {
  const { emailVerified, role, adminScope, accountStatus, internalNote } = body;
  const actorId = actor.id;

  const targetRes = await getPool().query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1`, [userId]);
  const target = targetRes.rows[0];
  if (!target) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const needsEdit =
    emailVerified !== undefined || accountStatus !== undefined || internalNote !== undefined;
  const needsFull = role !== undefined || adminScope !== undefined;

  if (needsEdit) adminAccess.assertMinScope(actor, 'edit');
  if (needsFull) adminAccess.assertMinScope(actor, 'full');

  const fields = [];
  const values = [];
  let i = 1;

  if (emailVerified !== undefined) {
    fields.push(`email_verified = $${i++}`);
    values.push(Boolean(emailVerified));
  }

  if (internalNote !== undefined) {
    fields.push(`internal_note = $${i++}`);
    values.push(internalNote || null);
  }

  if (accountStatus !== undefined) {
    if (!['active', 'suspended'].includes(accountStatus)) {
      const err = new Error('Invalid account status');
      err.status = 400;
      throw err;
    }
    if (accountStatus === 'suspended') {
      await adminAccess.assertCanSuspend(actorId, target, true);
    }
    fields.push(`account_status = $${i++}`);
    values.push(accountStatus);
  }

  if (role !== undefined) {
    await adminAccess.assertCanChangeRole(actorId, target, role);
    fields.push(`role = $${i++}`);
    values.push(role);
    if (role === 'user') {
      fields.push(`admin_scope = $${i++}`);
      values.push('none');
    } else if (role === 'admin' && adminScope === undefined && target.role !== 'admin') {
      fields.push(`admin_scope = $${i++}`);
      values.push('view');
    }
  }

  if (adminScope !== undefined) {
    const nextRole = role !== undefined ? role : target.role;
    const nextUser = { ...target, role: nextRole };
    await adminAccess.assertCanChangeScope(nextUser, adminScope);
    fields.push(`admin_scope = $${i++}`);
    values.push(nextRole === 'admin' ? adminScope : 'none');
  }

  if (!fields.length) {
    const err = new Error('No fields to update');
    err.status = 400;
    throw err;
  }

  values.push(userId);
  const { rows } = await getPool().query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${USER_FIELDS}`,
    values
  );

  await audit.logAction(actorId, 'user.update', 'user', userId, body);
  return rows[0];
}

async function deleteUser(actor, userId) {
  adminAccess.assertMinScope(actor, 'full', 'Only full-scope admins can permanently delete users');

  const targetRes = await getPool().query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1`, [userId]);
  const target = targetRes.rows[0];
  if (!target) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  await adminAccess.assertCanDelete(actor.id, target);

  await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
  await audit.logAction(actor.id, 'user.delete', 'user', userId, { email: target.email });
  return { deleted: true };
}

async function setEntitlement(actor, userId, featureKey, { active, adminNote }) {
  adminAccess.assertMinScope(actor, 'edit');
  const adminId = actor.id;

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

async function setOrderAccess(actor, orderId, { accessEnabled, adminNote }) {
  adminAccess.assertMinScope(actor, 'edit');
  const adminId = actor.id;

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

async function adjustGold(actor, userId, amount, note) {
  adminAccess.assertMinScope(actor, 'edit');
  const adminId = actor.id;

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
  const productCatalog = require('./productCatalog');
  const [merged, catalogRows] = await Promise.all([
    productCatalog.resolveAllProducts(),
    productCatalog.getAllCatalogRows(),
  ]);
  const updatedByKey = new Map(catalogRows.map((r) => [r.product_key, r.updated_at]));

  return merged.map((p) => ({
    product_key: p.key,
    name: p.name,
    mode: p.mode,
    enabled: p.enabled,
    category: p.category,
    description: p.description,
    amount_cents: p.amount,
    default_amount_cents: p.defaultAmount,
    display_price: p.displayPrice,
    badge: p.badge,
    savings: p.savings,
    sort_order: p.sortOrder,
    price_overridden: p.priceOverridden,
    gold: p.gold,
    energy: p.energy,
    updated_at: updatedByKey.get(p.key) || null,
  }));
}

async function setProductEnabled(actor, productKey, enabled) {
  return updateProduct(actor, productKey, { enabled });
}

async function updateProduct(actor, productKey, fields) {
  adminAccess.assertMinScope(actor, 'edit');
  const adminId = actor.id;
  const stripeService = require('./stripe');
  const base = stripeService.PRODUCTS[productKey];
  if (!base) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const updates = [];
  const values = [productKey];
  let idx = 2;

  if (fields.enabled !== undefined) {
    updates.push(`enabled = $${idx++}`);
    values.push(Boolean(fields.enabled));
  }
  if (fields.name !== undefined) {
    const name = String(fields.name).trim();
    if (!name || name.length > 80) {
      const err = new Error('Name must be 1–80 characters');
      err.status = 400;
      throw err;
    }
    updates.push(`name = $${idx++}`);
    values.push(name);
  }
  if (fields.description !== undefined) {
    updates.push(`description = $${idx++}`);
    values.push(fields.description ? String(fields.description).trim() : null);
  }
  if (fields.badge !== undefined) {
    updates.push(`badge = $${idx++}`);
    values.push(fields.badge ? String(fields.badge).trim() : null);
  }
  if (fields.savings !== undefined) {
    updates.push(`savings = $${idx++}`);
    values.push(fields.savings ? String(fields.savings).trim() : null);
  }
  if (fields.sortOrder !== undefined) {
    updates.push(`sort_order = $${idx++}`);
    values.push(Number(fields.sortOrder) || 0);
  }
  if (fields.amountCents !== undefined) {
    if (fields.amountCents === null) {
      updates.push(`amount_cents = NULL`);
      updates.push(`price_overridden = FALSE`);
    } else {
      const cents = Number(fields.amountCents);
      if (!Number.isInteger(cents) || cents < 50 || cents > 999999) {
        const err = new Error('Price must be between $0.50 and $9,999.99');
        err.status = 400;
        throw err;
      }
      updates.push(`amount_cents = $${idx++}`);
      values.push(cents);
      updates.push(`price_overridden = $${idx++}`);
      values.push(cents !== base.amount);
    }
  }

  if (!updates.length) {
    const err = new Error('No fields to update');
    err.status = 400;
    throw err;
  }

  updates.push('updated_at = NOW()');

  const { rows } = await getPool().query(
    `UPDATE product_catalog SET ${updates.join(', ')}
     WHERE product_key = $1 RETURNING *`,
    values
  );
  if (!rows[0]) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  await audit.logAction(adminId, 'product.update', 'product', productKey, fields);

  const productCatalog = require('./productCatalog');
  const resolved = await productCatalog.resolveProduct(productKey);
  return {
    product_key: resolved.key,
    name: resolved.name,
    mode: resolved.mode,
    enabled: resolved.enabled,
    category: resolved.category,
    description: resolved.description,
    amount_cents: resolved.amount,
    default_amount_cents: resolved.defaultAmount,
    display_price: resolved.displayPrice,
    badge: resolved.badge,
    savings: resolved.savings,
    sort_order: resolved.sortOrder,
    price_overridden: resolved.priceOverridden,
    updated_at: rows[0].updated_at,
  };
}

module.exports = {
  listUsers,
  getUserDetail,
  createUser,
  updateUser,
  deleteUser,
  setEntitlement,
  setOrderAccess,
  adjustGold,
  listProducts,
  setProductEnabled,
  updateProduct,
};
