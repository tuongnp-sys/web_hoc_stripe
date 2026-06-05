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
5. **Environment:**

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Neon connection string |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` từ Dashboard |
| `JWT_SECRET` | chuỗi random dài |
| `CLIENT_URL` | `https://your-app.vercel.app` |
| `NODE_ENV` | `production` |

6. Lưu URL API: `https://your-api.onrender.com`

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

1. **Webhooks** → endpoint `https://your-api.onrender.com/webhook`
2. **Customer Portal** → Settings → bật Portal (cho subscription)
3. Test với thẻ `4242 4242 4242 4242`

## Checklist

- [ ] `DATABASE_URL` trên Render
- [ ] `VITE_API_URL` trên Vercel trỏ Render
- [ ] `CLIENT_URL` trên Render trỏ Vercel
- [ ] Webhook Stripe trỏ Render
- [ ] CORS: `CLIENT_URL` khớp domain Vercel (kể cả không có `www`)

## Free tier

- Render free: service sleep sau idle → cold start ~30s
- Neon free: DB có thể suspend — wake khi có query
- Vercel hobby: đủ cho SPA
