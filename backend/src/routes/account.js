const express = require('express');
const { requireAuth } = require('../middleware/auth');
const orders = require('../services/orders');
const subscriptions = require('../services/subscriptions');
const entitlements = require('../services/entitlements');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [orderList, subList, entList] = await Promise.all([
      orders.listForUser(req.user.id),
      subscriptions.listForUser(req.user.id),
      entitlements.listForUser(req.user.id),
    ]);

    res.json({
      orders: orderList,
      subscriptions: subList,
      entitlements: entList,
      gameUnlock: await entitlements.hasEntitlement(req.user.id, 'game_unlock'),
      premium: await entitlements.hasEntitlement(req.user.id, 'premium'),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
