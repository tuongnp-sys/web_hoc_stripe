const express = require('express');
const { config } = require('../config');
const stripeService = require('../services/stripe');
const { processEvent } = require('../services/webhookHandler');
const { getPool } = require('../db/pool');

const router = express.Router();

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!config.stripeWebhookSecret) {
    return res.status(503).send('Webhook secret not configured');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeService.constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('[webhook] signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const pool = getPool();
  const { rows: existing } = await pool.query(
    'SELECT 1 FROM webhook_events WHERE stripe_event_id = $1',
    [event.id]
  );
  if (existing.length > 0) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    await pool.query(
      'INSERT INTO webhook_events (stripe_event_id, type, payload) VALUES ($1, $2, $3)',
      [event.id, event.type, JSON.stringify(event.data.object)]
    );
    await processEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error('[webhook] process error:', err.message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = router;
