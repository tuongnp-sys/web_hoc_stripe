# Email (Resend) — verification & password reset

## How it works

- Registration sends a verification link via [Resend](https://resend.com).
- `POST /api/auth/resend-verification` — resend to current email.
- `POST /api/auth/update-email` — change email (unverified accounts only) and resend.
- Verification link: `{CLIENT_URL}/verify-email?token=...` (no login required).

## Local development (Resend sandbox)

With `EMAIL_FROM=Gold Rush <onboarding@resend.dev>`, Resend **only delivers to the Resend account owner email** (shown in API error).

**In dev, the app always shows the verification/reset link on screen** — you do not need to wait for inbox delivery.

Options:

1. Use the **in-app link** on Verify Email or Forgot Password pages.
2. Register with your Resend owner email (e.g. the Gmail tied to Resend) to receive real mail.
3. Verify a domain at [resend.com/domains](https://resend.com/domains) and set `EMAIL_FROM` to that domain.

### Dev test account

On startup (`NODE_ENV=development`), the API seeds:

- Email: `admin@localhost`
- Password: `admin123456`
- Email already verified (for quick Stripe testing)

## Environment

```env
RESEND_API_KEY=re_...
EMAIL_FROM=Gold Rush <onboarding@resend.dev>
CLIENT_URL=http://localhost:5173
```

## Fake / undeliverable emails

Registration rejects obvious fake domains (`lab.local`, `example.com`, disposable inboxes, etc.).

If you used a wrong address, open **Verify Your Email** and use **Update email address**.

## Production

1. Verify your domain on Resend.
2. Set `EMAIL_FROM=Gold Rush <noreply@yourdomain.com>`.
3. Ensure `CLIENT_URL` matches your Vercel HTTPS URL.
