# Lộ trình học — Stripe Payment Lab

## Bài 1: Checkout one-time

**Mục tiêu:** Tạo phiên thanh toán, redirect Stripe, metadata `userId`.

**Thực hành:** Đăng ký → Nạp $4.99 → thẻ `4242...`

**Tự kiểm tra:**
- Secret key có trên frontend không? (phải: không)
- `metadata` chứa gì?

## Bài 2: Verify vs Webhook

**Mục tiêu:** Hiểu hai nguồn xác nhận.

| | verify-session | webhook |
|--|----------------|---------|
| Khi nào | Sau redirect | Stripe gọi server |
| Local | Đủ cho demo | Cần CLI hoặc deploy |
| Production | UI nhanh | Nguồn chân lý |

**Thực hành:** Thanh toán xong, xem `webhook_events` trong DB (route `/admin` dev).

## Bài 3: Auth + PostgreSQL

**Mục tiêu:** Mỗi user có đơn và entitlement riêng trên Neon.

**Thực hành:** 2 tài khoản — A thanh toán, B vẫn khóa.

## Bài 4: Subscription

**Mục tiêu:** `mode: subscription`, premium monthly $9.99.

**Thực hành:** `/shop` → Đăng ký Premium → `/account` xem subscription.

## Bài 5: Customer Portal & Refund

**Mục tiêu:** Hủy gói qua Portal; refund thu hồi quyền.

**Thực hành:** Dashboard Stripe → refund đơn → game khóa lại.

## Bài 6: Deploy bộ 3

Xem [DEPLOY.md](./DEPLOY.md) — Vercel + Render + webhook production.
