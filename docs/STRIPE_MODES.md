# Stripe test vs live mode

The app supports two Stripe environments. **Test mode is the default** for local development and student labs.

## Modes

| Mode | Keys | Webhook endpoint |
|------|------|------------------|
| Test | `STRIPE_SECRET_KEY` (`sk_test_...`) | `POST /webhook` |
| Live | `STRIPE_SECRET_KEY_LIVE` (`sk_live_...`) | `POST /webhook/live` |

The frontend sends `X-Stripe-Mode: test|live` on checkout and portal requests.

## Backend environment

```env
# Test (required)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Live (optional until production)
STRIPE_SECRET_KEY_LIVE=sk_live_...
STRIPE_WEBHOOK_SECRET_LIVE=whsec_...
STRIPE_LIVE_ALLOWED=true
CLIENT_URL=https://your-app.vercel.app
```

Live mode is blocked until:

1. Live secret key is set
2. Live webhook secret is set
3. `CLIENT_URL` is an HTTPS production domain (not localhost)
4. `STRIPE_LIVE_ALLOWED=true`

Check readiness: `GET /api/stripe/config`

## Local webhook (test)

```bash
stripe listen --forward-to localhost:3000/webhook
```

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Production webhooks

Register two endpoints in Stripe Dashboard:

- Test: `https://your-api.onrender.com/webhook`
- Live: `https://your-api.onrender.com/webhook/live`

## Frontend toggle

The nav bar shows **TEST** / **LIVE** badge and toggle. Live is disabled until the checklist on **Billing** is complete.

Test card: `4242 4242 4242 4242`

## Orders

Each order stores `stripe_mode` so pending-order sync uses the correct Stripe account.
