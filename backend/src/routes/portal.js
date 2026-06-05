const express = require('express');
const { config } = require('../config');
const { requireAuth } = require('../middleware/auth');
const stripeService = require('../services/stripe');

const router = express.Router();

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const customerId = await stripeService.getOrCreateCustomer(req.user);
    const session = await stripeService.createPortalSession(
      customerId,
      `${config.clientUrl}/account`
    );
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
