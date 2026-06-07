const express = require('express');
const { requireAdminAuth, requireScope } = require('../middleware/admin');
const adminUsers = require('../services/adminUsers');
const adminAccess = require('../services/adminAccess');
const audit = require('../services/adminAudit');
const orders = require('../services/orders');
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
    const { enabled } = req.body;
    if (enabled === undefined) {
      return res.status(400).json({ error: 'enabled is required' });
    }
    const product = await adminUsers.setProductEnabled(req.user, req.params.key, enabled);
    res.json({ product });
  } catch (err) {
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
