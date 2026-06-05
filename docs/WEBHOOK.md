# Webhook Stripe

Webhook là **nguồn chân lý** cập nhật đơn hàng và quyền truy cập trên production.

## Events xử lý

| Event | Hành động |
|-------|-----------|
| `checkout.session.completed` | Đánh dấu đơn `paid`, cấp entitlement |
| `checkout.session.expired` | Đánh dấu đơn `expired` |
| `customer.subscription.updated` | Cập nhật subscription + premium |
| `customer.subscription.deleted` | Thu hồi premium |
| `charge.refunded` | Đơn `refunded`, thu hồi entitlement |

Mỗi event lưu `stripe_event_id` — gửi trùng sẽ bỏ qua (idempotent).

## Local (Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/webhook
```

Copy `whsec_...` → `STRIPE_WEBHOOK_SECRET` trong `backend/.env`, restart API.

Trigger test:

```bash
stripe trigger checkout.session.completed
```

## Production (Render)

1. Stripe Dashboard → **Webhooks** → Add endpoint
2. URL: `https://your-api.onrender.com/webhook`
3. Chọn events ở bảng trên
4. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` trên Render

**Lưu ý:** Secret local (`stripe listen`) khác secret Dashboard production.
