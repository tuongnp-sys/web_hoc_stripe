const { getPool } = require('../db/pool');
const audit = require('./adminAudit');
const adminAccess = require('./adminAccess');
const { buildRefundPolicyContent, DEFAULT_WINDOW_HOURS } = require('../content/refundPolicyTemplate');

const REFUND_POLICY_KEY = 'refund_policy';
const MIN_WINDOW_HOURS = 1;
const MAX_WINDOW_HOURS = 168;

let cachedWindowMs = DEFAULT_WINDOW_HOURS * 60 * 60 * 1000;

function getRefundWindowMs() {
  return cachedWindowMs;
}

function getRefundWindowHours() {
  return Math.round(cachedWindowMs / (60 * 60 * 1000));
}

async function getRefundPolicySettings() {
  const { rows } = await getPool().query(
    'SELECT value, updated_at, updated_by FROM app_settings WHERE key = $1',
    [REFUND_POLICY_KEY]
  );
  const row = rows[0];
  const windowHours = Number(row?.value?.windowHours) || DEFAULT_WINDOW_HOURS;
  return {
    windowHours,
    updatedAt: row?.updated_at || null,
    updatedBy: row?.updated_by || null,
  };
}

async function refreshRefundWindowCache() {
  const { windowHours } = await getRefundPolicySettings();
  cachedWindowMs = windowHours * 60 * 60 * 1000;
  return windowHours;
}

async function getRefundPolicyContent() {
  const settings = await getRefundPolicySettings();
  const lastUpdated = settings.updatedAt
    ? new Date(settings.updatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : undefined;
  return buildRefundPolicyContent({ windowHours: settings.windowHours, lastUpdated });
}

async function setRefundPolicySettings(actor, { windowHours }) {
  adminAccess.assertMinScope(actor, 'edit');

  const hours = Number(windowHours);
  if (!Number.isInteger(hours) || hours < MIN_WINDOW_HOURS || hours > MAX_WINDOW_HOURS) {
    const err = new Error(`Refund window must be ${MIN_WINDOW_HOURS}–${MAX_WINDOW_HOURS} hours`);
    err.status = 400;
    throw err;
  }

  const { rows } = await getPool().query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by
     RETURNING updated_at`,
    [REFUND_POLICY_KEY, JSON.stringify({ windowHours: hours }), actor.id]
  );

  cachedWindowMs = hours * 60 * 60 * 1000;

  await audit.logAction(actor.id, 'settings.refund_policy', 'app_settings', REFUND_POLICY_KEY, {
    windowHours: hours,
  });

  const content = buildRefundPolicyContent({
    windowHours: hours,
    lastUpdated: new Date(rows[0].updated_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  });

  return {
    windowHours: hours,
    updatedAt: rows[0].updated_at,
    policy: content,
  };
}

module.exports = {
  getRefundWindowMs,
  getRefundWindowHours,
  getRefundPolicySettings,
  getRefundPolicyContent,
  setRefundPolicySettings,
  refreshRefundWindowCache,
  MIN_WINDOW_HOURS,
  MAX_WINDOW_HOURS,
};
