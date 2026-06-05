const express = require('express');
const { requireAuth } = require('../middleware/auth');
const entitlements = require('../services/entitlements');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const list = await entitlements.listForUser(req.user.id);
    const gameUnlock = await entitlements.hasEntitlement(req.user.id, 'game_unlock');
    const premium = await entitlements.hasEntitlement(req.user.id, 'premium');
    res.json({
      gameUnlock,
      premium,
      paid: gameUnlock,
      entitlements: list,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
