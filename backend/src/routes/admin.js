const express = require('express');
const { requireAdminAuth, requireScope } = require('../middleware/admin');
const adminUsers = require('../services/adminUsers');
const adminAccess = require('../services/adminAccess');
const audit = require('../services/adminAudit');
const orders = require('../services/orders');
const refunds = require('../services/refunds');
const appSettings = require('../services/appSettings');
const { getPool } = require('../db/pool');

const router = express.Router();

router.use(requireAdminAuth);
router.use(requireScope('view'));

router.get('/session', (req, res) => {
  res.json(adminAccess.buildSession(req.user));
});

router.get('/users', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = Number(req.query.offset) || 0;
    const result = await adminUsers.listUsers({
      search: req.query.search || '',
      limit,
      offset,
      actor: req.user,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const detail = await adminUsers.getUserDetail(req.params.id, req.user);
    if (!detail) return res.status(404).json({ error: 'User not found' });
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

router.post('/users', requireScope('full'), async (req, res, next) => {
  try {
    const { email, password, role, emailVerified, adminScope } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const user = await adminUsers.createUser(req.user, {
      email,
      password,
      role,
      emailVerified,
      adminScope,
    });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', requireScope('edit'), async (req, res, next) => {
  try {
    const user = await adminUsers.updateUser(req.user, req.params.id, req.body);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', requireScope('full'), async (req, res, next) => {
  try {
    const result = await adminUsers.deleteUser(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/entitlements/:featureKey', requireScope('edit'), async (req, res, next) => {
  try {
    const { active, adminNote } = req.body;
    if (active === undefined) {
      return res.status(400).json({ error: 'active is required' });
    }
    const list = await adminUsers.setEntitlement(
      req.user,
      req.params.id,
      req.params.featureKey,
      { active, adminNote }
    );
    res.json({ entitlements: list });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/wallet', requireScope('edit'), async (req, res, next) => {
  try {
    const { amount, note } = req.body;
    const result = await adminUsers.adjustGold(req.user, req.params.id, amount, note);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/orders/:id/access', requireScope('edit'), async (req, res, next) => {
  try {
    const { accessEnabled, adminNote } = req.body;
    if (accessEnabled === undefined) {
      return res.status(400).json({ error: 'accessEnabled is required' });
    }
    const order = await adminUsers.setOrderAccess(req.user, req.params.id, {
      accessEnabled,
      adminNote,
    });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

router.get('/refund-requests/count', async (_req, res, next) => {
  try {
    const count = await refunds.countPending();
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

router.get('/refund-requests', async (_req, res, next) => {
  try {
    const requests = await refunds.listPending();
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/refund', requireScope('edit'), async (req, res, next) => {
  try {
    const { rows } = await getPool().query(
      `SELECT id, user_id, status, mode, paid_at, created_at, gold_amount, gold_unspent,
              stripe_payment_intent_id, product_key
       FROM orders WHERE id = $1`,
      [req.params.id]
    );
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const existing = await refunds.findByOrderId(order.id);
    if (!existing || existing.status !== 'pending') {
      return res.status(400).json({ error: 'No pending refund request for this order' });
    }

    if (!refunds.isEligible(order)) {
      return res.status(400).json({
        error: 'Order is no longer eligible for refund',
      });
    }

    const processed = await refunds.processRefund(existing.id);

    await audit.logAction(req.user.id, 'refund.approve', 'order', order.id, {
      refundRequestId: existing.id,
      targetUserId: order.user_id,
    });

    res.status(201).json({ refund: processed });
  } catch (err) {
    if (err.message.includes('not eligible') || err.message.includes('No pending')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/orders/:id/refund/reject', requireScope('edit'), async (req, res, next) => {
  try {
    const { rows } = await getPool().query('SELECT id, user_id FROM orders WHERE id = $1', [
      req.params.id,
    ]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const rejected = await refunds.rejectRequest(order.id);

    await audit.logAction(req.user.id, 'refund.reject', 'order', order.id, {
      refundRequestId: rejected.id,
      targetUserId: order.user_id,
    });

    res.json({ request: rejected });
  } catch (err) {
    if (err.message.includes('No pending')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/products', async (_req, res, next) => {
  try {
    const products = await adminUsers.listProducts();
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

router.patch('/products/:key', requireScope('edit'), async (req, res, next) => {
  try {
    const { enabled, name, description, amountCents, badge, savings, sortOrder } = req.body;
    const hasField =
      enabled !== undefined ||
      name !== undefined ||
      description !== undefined ||
      amountCents !== undefined ||
      badge !== undefined ||
      savings !== undefined ||
      sortOrder !== undefined;

    if (!hasField) {
      return res.status(400).json({ error: 'At least one field is required' });
    }

    const product = await adminUsers.updateProduct(req.user, req.params.key, {
      enabled,
      name,
      description,
      amountCents,
      badge,
      savings,
      sortOrder,
    });
    res.json({ product });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.get('/settings/refund-policy', async (_req, res, next) => {
  try {
    const settings = await appSettings.getRefundPolicySettings();
    const policy = await appSettings.getRefundPolicyContent();
    res.json({
      windowHours: settings.windowHours,
      minWindowHours: appSettings.MIN_WINDOW_HOURS,
      maxWindowHours: appSettings.MAX_WINDOW_HOURS,
      updatedAt: settings.updatedAt,
      policy,
      previewSections: policy.sections.filter((s) =>
        ['2. Eligibility Window', '6. Non-Refundable Items'].includes(s.heading)
      ),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/settings/refund-policy', requireScope('edit'), async (req, res, next) => {
  try {
    const { windowHours } = req.body;
    if (windowHours === undefined) {
      return res.status(400).json({ error: 'windowHours is required' });
    }
    const result = await appSettings.setRefundPolicySettings(req.user, { windowHours });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.get('/orders', async (_req, res, next) => {
  try {
    const list = await orders.listAll();
    res.json({ orders: list });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-log', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const events = await audit.listRecent(limit);
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

router.get('/webhook-events', async (_req, res, next) => {
  try {
    const { rows } = await getPool().query(
      `SELECT stripe_event_id, type, processed_at
       FROM webhook_events ORDER BY processed_at DESC LIMIT 50`
    );
    res.json({ events: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
