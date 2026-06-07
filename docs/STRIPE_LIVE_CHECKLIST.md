# Stripe Live Mode Checklist

Use this checklist before submitting your Stripe account for live activation.

## Website requirements

- [ ] Footer visible on all pages (login, register, deposit, game)
- [ ] Terms of Service at `/terms` (English)
- [ ] Privacy Policy at `/privacy` (GDPR/CCPA compliant)
- [ ] Refund Policy at `/refund-policy` (48h window, virtual currency)
- [ ] Support email listed in footer and legal pages *(placeholder `support@goldrushgame.example.com` — bổ sung email thật sau khi có domain)*
- [ ] Add Funds page clearly describes virtual Gold (not gambling)
- [ ] Product names and USD prices visible before checkout

## Stripe Dashboard

- [ ] Complete business profile (matches website description)
- [ ] Enable **Stripe Tax** (Settings → Tax)
- [ ] Create live webhook: `POST https://your-api.onrender.com/webhook`
- [ ] Events: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Copy live webhook secret to `STRIPE_WEBHOOK_SECRET` on Render
- [ ] Switch to live API keys (`sk_live_...`) on Render
- [ ] Optional: create live Price IDs for gold packs

## Environment variables (production)

### Backend (Render)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=...
JWT_SECRET=...
CLIENT_URL=https://your-app.vercel.app
API_PUBLIC_URL=https://your-api.onrender.com
RESEND_API_KEY=re_...
EMAIL_FROM=Gold Rush <support@yourdomain.com>
GOOGLE_CLIENT_ID=...        # optional
GOOGLE_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...       # optional
DISCORD_CLIENT_SECRET=...
EXTRA_CORS_ORIGINS=https://your-app.vercel.app
```

### Frontend (Vercel)

```
VITE_API_URL=https://your-api.onrender.com
```

## End-to-end test (test mode first)

1. Register with legal checkboxes + age confirmation
2. Verify email (check backend console in dev, or Resend in prod)
3. Add Funds → select pack → complete Stripe Checkout (`4242...`)
4. Confirm Gold credited on game page
5. Check Billing History → download invoice
6. Request refund within 48h (Gold unspent) → confirm status

## First live charge (production)

1. Register + verify email (Resend prod)
2. Add Funds → **Starter Pack ($0.50)** → real card
3. Confirm: webhook 200, Gold credited, Billing = Succeeded
4. Test refund within 48h (Gold unspent)

## OAuth redirect URIs (if using social login)

- Google: `https://your-api.onrender.com/api/oauth/google/callback`
- Discord: `https://your-api.onrender.com/api/oauth/discord/callback`
