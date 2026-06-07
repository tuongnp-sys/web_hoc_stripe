const express = require('express');
const { requireAuth } = require('../middleware/auth');
const orders = require('../services/orders');
const stripeService = require('../services/stripe');

const router = express.Router();

router.get('/:orderId/pdf', requireAuth, async (req, res, next) => {
  try {
    const order = await orders.findById(req.params.orderId, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!order.stripe_invoice_id) {
      return res.status(404).json({ error: 'No invoice available for this order' });
    }

    const pdfUrl = await stripeService.getInvoicePdfUrl(order.stripe_invoice_id);
    if (!pdfUrl) {
      return res.status(404).json({ error: 'Invoice PDF not ready yet' });
    }

    res.json({ url: pdfUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
