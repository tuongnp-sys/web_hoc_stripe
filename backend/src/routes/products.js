const express = require('express');
const stripeService = require('../services/stripe');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ products: stripeService.getProducts() });
});

module.exports = router;
