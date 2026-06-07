const { getPool } = require('../db/pool');

async function ensureWallet(userId, client = null) {
  const db = client || getPool();
  await db.query(
    `INSERT INTO wallets (user_id, gold_balance) VALUES ($1, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

async function getBalance(userId) {
  await ensureWallet(userId);
  const { rows } = await getPool().query(
    'SELECT gold_balance FROM wallets WHERE user_id = $1',
    [userId]
  );
  return rows[0]?.gold_balance ?? 0;
}

async function creditGold(userId, amount, orderId, description, client = null) {
  const db = client || getPool();
  await ensureWallet(userId, db);

  const { rows } = await db.query(
    `UPDATE wallets SET gold_balance = gold_balance + $2, updated_at = NOW()
     WHERE user_id = $1 RETURNING gold_balance`,
    [userId, amount]
  );
  const balanceAfter = rows[0].gold_balance;

  await db.query(
    `INSERT INTO wallet_transactions (user_id, type, amount, order_id, balance_after, description)
     VALUES ($1, 'credit', $2, $3, $4, $5)`,
    [userId, amount, orderId, balanceAfter, description]
  );

  if (orderId) {
    await db.query(
      `UPDATE orders SET gold_unspent = COALESCE(gold_unspent, 0) + $2 WHERE id = $1`,
      [orderId, amount]
    );
  }

  return balanceAfter;
}

async function spendGold(userId, amount, description) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await ensureWallet(userId, client);

    const { rows: walletRows } = await client.query(
      'SELECT gold_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    const balance = walletRows[0]?.gold_balance ?? 0;
    if (balance < amount) {
      await client.query('ROLLBACK');
      return { ok: false, balance };
    }

    const balanceAfter = balance - amount;
    await client.query(
      'UPDATE wallets SET gold_balance = $2, updated_at = NOW() WHERE user_id = $1',
      [userId, balanceAfter]
    );

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description)
       VALUES ($1, 'spend', $2, $3, $4)`,
      [userId, amount, balanceAfter, description]
    );

    let remaining = amount;
    const { rows: orders } = await client.query(
      `SELECT id, gold_unspent FROM orders
       WHERE user_id = $1 AND status = 'paid' AND gold_unspent > 0 AND access_enabled = TRUE
       ORDER BY paid_at ASC`,
      [userId]
    );

    for (const order of orders) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, order.gold_unspent);
      await client.query(
        'UPDATE orders SET gold_unspent = gold_unspent - $2 WHERE id = $1',
        [order.id, deduct]
      );
      remaining -= deduct;
    }

    await client.query('COMMIT');
    return { ok: true, balance: balanceAfter };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function debitGoldForRefund(userId, amount, orderId, description) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await ensureWallet(userId, client);

    const { rows } = await client.query(
      'SELECT gold_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    const balance = rows[0]?.gold_balance ?? 0;
    const debitAmount = Math.min(amount, balance);

    const balanceAfter = balance - debitAmount;
    await client.query(
      'UPDATE wallets SET gold_balance = $2, updated_at = NOW() WHERE user_id = $1',
      [userId, balanceAfter]
    );

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, order_id, balance_after, description)
       VALUES ($1, 'refund', $2, $3, $4, $5)`,
      [userId, debitAmount, orderId, balanceAfter, description]
    );

    await client.query('UPDATE orders SET gold_unspent = 0 WHERE id = $1', [orderId]);

    await client.query('COMMIT');
    return balanceAfter;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getUnspentGoldForOrder(orderId) {
  const { rows } = await getPool().query(
    'SELECT gold_unspent FROM orders WHERE id = $1',
    [orderId]
  );
  return rows[0]?.gold_unspent ?? 0;
}

async function listTransactions(userId, limit = 50) {
  const { rows } = await getPool().query(
    `SELECT id, type, amount, order_id, balance_after, description, created_at
     FROM wallet_transactions WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

module.exports = {
  ensureWallet,
  getBalance,
  creditGold,
  spendGold,
  debitGoldForRefund,
  getUnspentGoldForOrder,
  listTransactions,
};
