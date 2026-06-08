const express = require('express');
const { resolveAllProducts } = require('../services/productCatalog');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const all = await resolveAllProducts();
    const products = all.filter((p) => p.enabled);
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
