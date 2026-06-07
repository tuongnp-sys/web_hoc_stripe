const express = require('express');
const stripeService = require('../services/stripe');
const { getEnabledKeys } = require('../services/productCatalog');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const enabled = await getEnabledKeys();
    const products = stripeService.getProducts().filter((p) => enabled.has(p.key));
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
