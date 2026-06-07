const express = require('express');
const { requireAuth } = require('../middleware/auth');
const wallet = require('../services/wallet');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const balance = await wallet.getBalance(req.user.id);
    res.json({ goldBalance: balance });
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', requireAuth, async (req, res, next) => {
  try {
    const transactions = await wallet.listTransactions(req.user.id);
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

router.post('/spend', requireAuth, async (req, res, next) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const result = await wallet.spendGold(
      req.user.id,
      amount,
      description || 'In-game purchase'
    );

    if (!result.ok) {
      return res.status(400).json({
        error: 'Insufficient Gold',
        goldBalance: result.balance,
      });
    }

    res.json({ goldBalance: result.balance });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
