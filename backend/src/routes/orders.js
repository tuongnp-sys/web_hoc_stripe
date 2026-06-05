const express = require('express');
const { requireAuth } = require('../middleware/auth');
const orders = require('../services/orders');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const list = await orders.listForUser(req.user.id);
    res.json({ orders: list });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const order = await orders.findById(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
