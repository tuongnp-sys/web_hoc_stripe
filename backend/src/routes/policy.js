const express = require('express');
const appSettings = require('../services/appSettings');

const router = express.Router();

router.get('/refund', async (_req, res, next) => {
  try {
    const policy = await appSettings.getRefundPolicyContent();
    res.json({ policy });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
