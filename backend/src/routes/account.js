const express = require('express');
const { requireAuth } = require('../middleware/auth');
const orders = require('../services/orders');
const subscriptions = require('../services/subscriptions');
const entitlements = require('../services/entitlements');
const wallet = require('../services/wallet');
const refunds = require('../services/refunds');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [orderList, subList, entList, goldBalance, refundList] = await Promise.all([
      orders.listForUser(req.user.id),
      subscriptions.listForUser(req.user.id),
      entitlements.listForUser(req.user.id),
      wallet.getBalance(req.user.id),
      refunds.listForUser(req.user.id),
    ]);

    res.json({
      orders: orderList,
      subscriptions: subList,
      entitlements: entList,
      refunds: refundList,
      goldBalance,
      premium: await entitlements.hasEntitlement(req.user.id, 'premium'),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
