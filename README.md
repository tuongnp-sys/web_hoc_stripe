# Joymed

Game thiền định **7 Layers of Ascent** + thanh toán **React (Vite)** + **Express** + **PostgreSQL (Neon)** + **Stripe Checkout**.

- Production: https://joymed.vercel.app
- API: https://web-hoc-stripe.onrender.com

## Tính năng

- Đăng ký / đăng nhập JWT
- Thanh toán one-time ($4.99 game unlock)
- Subscription monthly ($9.99 premium)
- Webhook idempotent (Neon)
- Customer Portal (quản lý subscription)
- Refund → thu hồi quyền
- Admin dev (`/admin` khi `npm run dev`)

## Chạy local

### Backend

```bash
cd backend
copy .env.example .env   # điền DATABASE_URL, STRIPE_*, JWT_SECRET
npm install
npm start
```

### Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:3000  

### Smoke test

```bash
cd backend
npm run smoke
```

## API

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/register` | — |
| POST | `/api/auth/login` | — |
| GET | `/api/products` | — |
| POST | `/api/checkout/one-time` | JWT |
| POST | `/api/checkout/subscription` | JWT |
| GET | `/api/checkout/verify-session/:id` | JWT |
| GET | `/api/account` | JWT |
| POST | `/api/portal` | JWT |
| POST | `/webhook` | Stripe |

## Deploy

GitHub + **Vercel** (frontend) + **Render** (backend) + **Neon** — xem [docs/DEPLOY.md](docs/DEPLOY.md).

## Tài liệu học

- [docs/LEARNING.md](docs/LEARNING.md)
- [docs/NEON_SETUP.md](docs/NEON_SETUP.md)
- [docs/WEBHOOK.md](docs/WEBHOOK.md)
- [docs/STRIPE_TEST_CARDS.md](docs/STRIPE_TEST_CARDS.md)
- [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md) — verification email & Resend sandbox
- [docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md) — Google/Discord redirect URIs
- [docs/STRIPE_MODES.md](docs/STRIPE_MODES.md) — test vs live mode toggle
