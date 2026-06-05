const express = require('express');
const { requireAdmin } = require('../middleware/admin');
const orders = require('../services/orders');
const { getPool } = require('../db/pool');

const router = express.Router();

router.use(requireAdmin);

router.get('/orders', async (_req, res, next) => {
  try {
    const list = await orders.listAll();
    res.json({ orders: list });
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
