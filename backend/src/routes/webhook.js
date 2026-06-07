const express = require('express');
const stripeService = require('../services/stripe');
const { processEvent } = require('../services/webhookHandler');
const { getPool } = require('../db/pool');
const { getWebhookSecret } = require('../services/stripeMode');

const router = express.Router();

async function handleWebhook(req, res, stripeMode) {
  const webhookSecret = getWebhookSecret(stripeMode);
  if (!webhookSecret) {
    return res.status(503).send(`Webhook secret not configured for ${stripeMode} mode`);
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeService.constructWebhookEvent(req.body, sig, stripeMode);
  } catch (err) {
    console.error(`[webhook/${stripeMode}] signature error:`, err.message);
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
    await processEvent(event);
    await pool.query(
      'INSERT INTO webhook_events (stripe_event_id, type, payload) VALUES ($1, $2, $3)',
      [event.id, event.type, JSON.stringify(event.data.object)]
    );
    res.json({ received: true });
  } catch (err) {
    console.error(`[webhook/${stripeMode}] process error:`, err.message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

router.post('/', express.raw({ type: 'application/json' }), (req, res) => {
  handleWebhook(req, res, 'test');
});

router.post('/live', express.raw({ type: 'application/json' }), (req, res) => {
  handleWebhook(req, res, 'live');
});

module.exports = router;
