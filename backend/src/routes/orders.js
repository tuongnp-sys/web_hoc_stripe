const express = require('express');
const { requireAuth } = require('../middleware/auth');
const orders = require('../services/orders');
const refunds = require('../services/refunds');
const { syncPendingOrdersForUser } = require('../services/webhookHandler');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    await syncPendingOrdersForUser(req.user.id);

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const [orderList, total] = await Promise.all([
      orders.listForUser(req.user.id, { limit, offset }),
      orders.countForUser(req.user.id),
    ]);

    const enriched = await Promise.all(
      orderList.map(async (order) => {
        const existingRefund = await refunds.findByOrderId(order.id);
        return {
          ...order,
          shortId: order.id.slice(0, 8).toUpperCase(),
          refundEligible: refunds.isEligible(order) && !existingRefund,
          refundRequest: existingRefund,
        };
      })
    );

    res.json({ orders: enriched, total, limit, offset });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const order = await orders.findById(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
