const { getPool } = require('../db/pool');
const entitlements = require('./entitlements');
const wallet = require('./wallet');

const DEFAULT_ENERGY = 5;
const MAX_ENERGY = 10;
const ENERGY_REFILL_MS = 24 * 60 * 60 * 1000;

const GOLD_COST = {
  refill_energy: 100,
  add_energy: 50,
};

async function isVip(userId) {
  return entitlements.hasEntitlement(userId, 'premium');
}

async function ensureProfile(userId, client = null) {
  const db = client || getPool();
  const { rows } = await db.query(
    `INSERT INTO game_profiles (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId]
  );
  if (rows.length) return rows[0];

  const existing = await db.query('SELECT * FROM game_profiles WHERE user_id = $1', [userId]);
  return existing.rows[0];
}

async function getProfileRow(userId, client = null) {
  const db = client || getPool();
  return ensureProfile(userId, db);
}

function applyEnergyRefillIfDue(profile, vip) {
  if (vip) return false;

  const lastRefillMs = Date.parse(profile.last_energy_refill_at);
  if (!Number.isFinite(lastRefillMs)) {
    profile.last_energy_refill_at = new Date().toISOString();
    return true;
  }

  if (Date.now() - lastRefillMs >= ENERGY_REFILL_MS) {
    profile.energy = DEFAULT_ENERGY;
    profile.last_energy_refill_at = new Date().toISOString();
    return true;
  }

  return false;
}

function buildEnergyStatus(profile, vip) {
  if (vip) {
    return {
      energy: profile.energy,
      isVip: true,
      nextRefillAt: null,
      msUntilRefill: 0,
    };
  }

  const lastRefillMs = Date.parse(profile.last_energy_refill_at);
  const safeLastRefillMs = Number.isFinite(lastRefillMs) ? lastRefillMs : Date.now();
  const nextRefillMs = safeLastRefillMs + ENERGY_REFILL_MS;
  const msUntilRefill = Math.max(0, nextRefillMs - Date.now());

  return {
    energy: profile.energy,
    isVip: false,
    nextRefillAt: new Date(nextRefillMs).toISOString(),
    msUntilRefill,
  };
}

async function syncProfileRefill(userId) {
  const vip = await isVip(userId);
  const profile = await getProfileRow(userId);
  const refilled = applyEnergyRefillIfDue(profile, vip);

  if (refilled) {
    const db = getPool();
    await db.query(
      `UPDATE game_profiles
       SET energy = $2, last_energy_refill_at = $3, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, profile.energy, profile.last_energy_refill_at]
    );
    await db.query(
      `INSERT INTO energy_transactions (user_id, type, amount, note)
       VALUES ($1, 'refill_24h', $2, 'Daily energy refill')`,
      [userId, DEFAULT_ENERGY]
    );
  }

  return { profile, vip, refilled };
}

async function getProfile(userId, displayName) {
  const { profile, vip } = await syncProfileRefill(userId);
  const goldBalance = await wallet.getBalance(userId);
  const energyStatus = buildEnergyStatus(profile, vip);

  return {
    displayName: displayName || 'Player',
    highScore: profile.high_score,
    maxLayer: profile.max_layer,
    energy: profile.energy,
    goldBalance,
    isVip: vip,
    nextRefillAt: energyStatus.nextRefillAt,
    msUntilRefill: energyStatus.msUntilRefill,
  };
}

async function getEnergyStatus(userId) {
  const { profile, vip } = await syncProfileRefill(userId);
  return buildEnergyStatus(profile, vip);
}

async function startGame(userId) {
  const { profile, vip } = await syncProfileRefill(userId);

  if (vip || profile.energy > 0) {
    if (!vip) {
      profile.energy -= 1;
      await getPool().query(
        `UPDATE game_profiles SET energy = $2, updated_at = NOW() WHERE user_id = $1`,
        [userId, profile.energy]
      );
      await getPool().query(
        `INSERT INTO energy_transactions (user_id, type, amount, note)
         VALUES ($1, 'spend', 1, 'Started meditation run')`,
        [userId]
      );
    }

    const userProfile = await getProfile(userId);
    return {
      allowed: true,
      message: vip ? 'VIP — unlimited plays.' : 'Game started. Energy consumed.',
      user: userProfile,
    };
  }

  const userProfile = await getProfile(userId);
  return {
    allowed: false,
    message: 'Out of Energy. Rest and return later, or upgrade to VIP.',
    user: userProfile,
  };
}

async function saveScore(userId, score, maxLayer) {
  const profile = await getProfileRow(userId);
  const parsedScore = Math.floor(score);
  const parsedMaxLayer =
    Number.isFinite(maxLayer) && maxLayer >= 1 && maxLayer <= 7
      ? Math.floor(maxLayer)
      : null;

  let isNewRecord = false;

  if (parsedScore > profile.high_score) {
    isNewRecord = true;
  }

  const newHigh = Math.max(profile.high_score, parsedScore);
  const newMax =
    parsedMaxLayer !== null ? Math.max(profile.max_layer, parsedMaxLayer) : profile.max_layer;

  if (isNewRecord || (parsedMaxLayer !== null && parsedMaxLayer > profile.max_layer)) {
    await getPool().query(
      `UPDATE game_profiles SET high_score = $2, max_layer = $3, updated_at = NOW() WHERE user_id = $1`,
      [userId, newHigh, newMax]
    );
  }

  const userProfile = await getProfile(userId);
  return { success: true, isNewRecord, user: userProfile };
}

async function getLeaderboard(limit = 10) {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const { rows } = await getPool().query(
    `SELECT u.email AS username, gp.high_score AS "highScore", gp.max_layer AS "maxLayer"
     FROM game_profiles gp
     JOIN users u ON u.id = gp.user_id
     ORDER BY gp.high_score DESC
     LIMIT $1`,
    [safeLimit]
  );

  return rows.map((row) => ({
    username: row.username.split('@')[0],
    highScore: row.highScore,
    maxLayer: row.maxLayer,
  }));
}

async function creditEnergy(userId, amount, orderId, { mode = 'add' } = {}, client = null) {
  const db = client || getPool();

  if (orderId) {
    const { rows } = await db.query(
      `SELECT 1 FROM energy_transactions
       WHERE user_id = $1 AND order_id = $2 AND type = 'credit' LIMIT 1`,
      [userId, orderId]
    );
    if (rows.length) {
      const profile = await getProfileRow(userId, db);
      return profile.energy;
    }
  }

  const profile = await ensureProfile(userId, db);
  const newEnergy =
    mode === 'full'
      ? DEFAULT_ENERGY
      : Math.min(MAX_ENERGY, profile.energy + amount);

  await db.query(
    `UPDATE game_profiles SET energy = $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, newEnergy]
  );

  await db.query(
    `INSERT INTO energy_transactions (user_id, order_id, type, amount, note)
     VALUES ($1, $2, 'credit', $3, $4)`,
    [userId, orderId, amount, mode === 'full' ? 'Energy refill (full)' : `Energy +${amount}`]
  );

  return newEnergy;
}

async function spendGoldForEnergy(userId, action) {
  const cost = GOLD_COST[action];
  if (!cost) {
    return { ok: false, error: 'Invalid action' };
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await wallet.ensureWallet(userId, client);

    const { rows: walletRows } = await client.query(
      'SELECT gold_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    const balance = walletRows[0]?.gold_balance ?? 0;
    if (balance < cost) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Insufficient Gold', goldBalance: balance };
    }

    const profile = await ensureProfile(userId, client);
    const balanceAfter = balance - cost;
    const newEnergy =
      action === 'refill_energy'
        ? DEFAULT_ENERGY
        : Math.min(MAX_ENERGY, profile.energy + 1);

    await client.query(
      'UPDATE wallets SET gold_balance = $2, updated_at = NOW() WHERE user_id = $1',
      [userId, balanceAfter]
    );
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description)
       VALUES ($1, 'spend', $2, $3, $4)`,
      [
        userId,
        cost,
        balanceAfter,
        action === 'refill_energy' ? 'Refill energy with Gold' : 'Add energy with Gold',
      ]
    );
    await client.query(
      `UPDATE game_profiles SET energy = $2, updated_at = NOW() WHERE user_id = $1`,
      [userId, newEnergy]
    );
    await client.query(
      `INSERT INTO energy_transactions (user_id, type, amount, note)
       VALUES ($1, 'gold_spend', $2, $3)`,
      [userId, action === 'refill_energy' ? DEFAULT_ENERGY : 1, `Spent ${cost} Gold`]
    );

    await client.query('COMMIT');

    const userProfile = await getProfile(userId);
    return { ok: true, user: userProfile, goldBalance: balanceAfter };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function debitEnergyForRefund(userId, { mode, amount }, orderId) {
  const profile = await getProfileRow(userId);
  let newEnergy = profile.energy;

  if (mode === 'full') {
    newEnergy = Math.max(0, profile.energy - DEFAULT_ENERGY);
  } else {
    newEnergy = Math.max(0, profile.energy - amount);
  }

  await getPool().query(
    `UPDATE game_profiles SET energy = $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, newEnergy]
  );

  await getPool().query(
    `INSERT INTO energy_transactions (user_id, order_id, type, amount, note)
     VALUES ($1, $2, 'refund', $3, 'Order refunded')`,
    [userId, orderId, mode === 'full' ? DEFAULT_ENERGY : amount]
  );

  return newEnergy;
}

const PRODUCT_ENERGY = {
  energy_refill: { mode: 'full', amount: 5 },
  energy_pack_5: { mode: 'add', amount: 5 },
};

module.exports = {
  DEFAULT_ENERGY,
  MAX_ENERGY,
  GOLD_COST,
  PRODUCT_ENERGY,
  getProfile,
  getEnergyStatus,
  startGame,
  saveScore,
  getLeaderboard,
  creditEnergy,
  spendGoldForEnergy,
  debitEnergyForRefund,
  isVip,
};
