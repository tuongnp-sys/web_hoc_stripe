const express = require('express');
const { getPublicStripeConfig } = require('../services/stripeMode');

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json(getPublicStripeConfig());
});

module.exports = router;
