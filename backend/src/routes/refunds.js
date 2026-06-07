const express = require('express');
const { requireAuth } = require('../middleware/auth');
const refunds = require('../services/refunds');
const orders = require('../services/orders');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const list = await refunds.listForUser(req.user.id);
    res.json({ refunds: list });
  } catch (err) {
    next(err);
  }
});

router.get('/eligibility/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await orders.findById(req.params.orderId, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const existing = await refunds.findByOrderId(order.id);
    res.json({
      eligible: refunds.isEligible(order) && !existing,
      goldUnspent: order.gold_unspent ?? 0,
      existingRequest: existing,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { orderId, reason, reasonDetail } = req.body;
    if (!orderId || !reason) {
      return res.status(400).json({ error: 'Order ID and reason are required' });
    }

    const request = await refunds.createRequest(
      req.user.id,
      orderId,
      reason,
      reasonDetail
    );

    const processed = await refunds.processRefund(request.id);
    res.status(201).json({ refund: processed });
  } catch (err) {
    if (err.message.includes('not eligible') || err.message.includes('already')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
