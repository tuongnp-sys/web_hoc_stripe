const express = require('express');
const { config } = require('../config');
const { requireAuth } = require('../middleware/auth');
const { requireStripeMode } = require('../middleware/stripeMode');
const stripeService = require('../services/stripe');

const router = express.Router();

router.use(requireStripeMode);

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const customerId = await stripeService.getOrCreateCustomer(req.user, req.stripeMode);
    const session = await stripeService.createPortalSession(
      customerId,
      `${config.clientUrl}/billing`,
      req.stripeMode
    );
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
