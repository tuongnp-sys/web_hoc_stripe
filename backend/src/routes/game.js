const express = require('express');
const { requireAuth } = require('../middleware/auth');
const game = require('../services/game');

const router = express.Router();

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const profile = await game.getProfile(req.user.id, req.user.email);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.get('/energy-status', requireAuth, async (req, res, next) => {
  try {
    const status = await game.getEnergyStatus(req.user.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.post('/start', requireAuth, async (req, res, next) => {
  try {
    const result = await game.startGame(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/score', requireAuth, async (req, res, next) => {
  try {
    const { score, maxLayer } = req.body || {};
    const parsedScore = Number(score);
    if (!Number.isFinite(parsedScore) || parsedScore < 0) {
      return res.status(400).json({ error: 'Valid score is required.' });
    }

    const result = await game.saveScore(req.user.id, parsedScore, maxLayer);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    let limit = Number.parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 10;
    const entries = await game.getLeaderboard(limit);
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

router.post('/spend-gold', requireAuth, async (req, res, next) => {
  try {
    const { action } = req.body || {};
    if (!action || !['refill_energy', 'add_energy'].includes(action)) {
      return res.status(400).json({ error: 'action must be refill_energy or add_energy' });
    }

    const result = await game.spendGoldForEnergy(req.user.id, action);
    if (!result.ok) {
      return res.status(400).json({
        error: result.error,
        goldBalance: result.goldBalance,
      });
    }

    res.json({
      success: true,
      user: result.user,
      goldBalance: result.goldBalance,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
