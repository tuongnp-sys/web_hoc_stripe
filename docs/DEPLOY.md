# Deploy — GitHub + Vercel + Render + Neon

## Tổng quan

| Thành phần | Nền tảng | Thư mục |
|------------|----------|---------|
| Code | GitHub | monorepo root |
| Frontend React | Vercel | `frontend/` |
| Backend API | Render | `backend/` |
| PostgreSQL | Neon | — |

## 1. Neon

Xem [NEON_SETUP.md](./NEON_SETUP.md). Copy `DATABASE_URL` (pooled).

## 2. GitHub

```bash
git init
git add .
git commit -m "Stripe payment lab"
git remote add origin https://github.com/YOUR_USER/web_hoc_stripe.git
git push -u origin main
```

Không commit `backend/.env` hay `frontend/.env`.

## 3. Render (Backend)

1. [render.com](https://render.com) → **New Web Service** → connect repo
2. **Root Directory:** `backend`
3. **Build:** `npm install`
4. **Start:** `npm start`
5. **Environment** (test mode hoặc live — xem bảng dưới)

6. Lưu URL API: `https://your-api.onrender.com`

### Environment variables

| Key | Test mode | Live mode |
|-----|-----------|-----------|
| `DATABASE_URL` | Neon connection string | Neon (prod DB khuyến nghị) |
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (test webhook) | `whsec_...` (live webhook) |
| `JWT_SECRET` | chuỗi random dài | chuỗi random dài (khác test) |
| `CLIENT_URL` | `https://your-app.vercel.app` | URL Vercel production |
| `API_PUBLIC_URL` | `https://your-api.onrender.com` | URL Render (không trailing space) |
| `EXTRA_CORS_ORIGINS` | URL Vercel | URL Vercel |
| `NODE_ENV` | `production` | `production` |
| `RESEND_API_KEY` | `re_...` | `re_...` |
| `EMAIL_FROM` | `Gold Rush <onboarding@resend.dev>` | `Gold Rush <support@yourdomain.com>` (domain verified) |
| `GOOGLE_CLIENT_ID` / `SECRET` | optional | optional — redirect URI prod |
| `DISCORD_CLIENT_ID` / `SECRET` | optional | optional — redirect URI prod |
| `STRIPE_PRICE_GOLD_*` | optional | optional — tạo Price live trên Dashboard |
| `STRIPE_PRICE_PREMIUM_MONTHLY` | optional | optional |
| `STRIPE_TAX_ENABLED` | `false` hoặc bỏ trống | `true` chỉ sau khi bật Stripe Tax |

File `render.yaml` ở repo root liệt kê các biến cần set trên Render Dashboard (`sync: false` = nhập thủ công).

### Health check

Render dùng `GET /health` — đã có sẵn.

## 4. Vercel (Frontend)

1. [vercel.com](https://vercel.com) → Import repo
2. **Root Directory:** `frontend`
3. Framework: **Vite**
4. **Environment:**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://your-api.onrender.com` |

5. Deploy → URL: `https://your-app.vercel.app`

6. Cập nhật `CLIENT_URL` trên Render = URL Vercel → **Redeploy** backend.

## 5. Stripe

### Test mode (staging)

1. **Webhooks** (test) → endpoint `https://your-api.onrender.com/webhook`
2. **Customer Portal** → Settings → bật Portal (cho subscription)
3. Test với thẻ `4242 4242 4242 4242` (chỉ hiện trên UI khi `npm run dev`)

### Live mode (production)

1. Hoàn thiện business profile trên Stripe Dashboard
2. Tạo **live webhook** → `https://your-api.onrender.com/webhook`
3. Events: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Đổi `STRIPE_SECRET_KEY` và `STRIPE_WEBHOOK_SECRET` trên Render sang live keys
5. **Stripe customer cũ từ test:** app tự reset khi dùng `sk_live_` (customer không tồn tại hoặc `cus_test*`). Hoặc chạy thủ công:

```sql
UPDATE users SET stripe_customer_id = NULL;
```

6. Verify Resend domain + `EMAIL_FROM` trước khi mở register cho user thật
7. Đăng ký OAuth redirect URIs production: `https://your-api.onrender.com/api/oauth/google/callback` (và Discord)

Checklist chi tiết: [STRIPE_LIVE_CHECKLIST.md](./STRIPE_LIVE_CHECKLIST.md)

### First live charge

1. Register + verify email (Resend prod)
2. Add Funds → Starter Pack ($0.50) → thẻ thật
3. Xác nhận: webhook 200, Gold credited, Billing = Succeeded
4. Test refund trong 48h (Gold chưa tiêu)

## Checklist

- [ ] `DATABASE_URL` trên Render
- [ ] `VITE_API_URL` trên Vercel trỏ Render
- [ ] `CLIENT_URL` + `API_PUBLIC_URL` trên Render (khớp domain thật, không space thừa)
- [ ] Webhook Stripe trỏ Render (test hoặc live tùy key)
- [ ] CORS: `CLIENT_URL` / `EXTRA_CORS_ORIGINS` khớp domain Vercel
- [ ] Live: `sk_live_` + live webhook secret + Resend domain verified

## Free tier

- Render free: service sleep sau idle → cold start ~30s
- Neon free: DB có thể suspend — wake khi có query
- Vercel hobby: đủ cho SPA
