# Thiết lập PostgreSQL trên Neon

Neon là PostgreSQL serverless, dùng làm database cho backend trên Render.

## 1. Tạo project Neon

1. Đăng ký tại [https://neon.tech](https://neon.tech)
2. **New Project** → đặt tên (vd. `stripe-lab`)
3. Chọn region gần bạn (vd. `AWS ap-southeast-1`)

## 2. Lấy connection string

1. Trong Neon Dashboard → **Connection Details**
2. Chọn **Pooled connection** (khuyến nghị cho serverless/Render)
3. Copy chuỗi dạng:

```
postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

## 3. Cấu hình backend

Dán vào `backend/.env`:

```env
DATABASE_URL=postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require
```

## 4. Chạy migration

```bash
cd backend
npm install
npm run migrate
```

Hoặc migration tự chạy khi `npm start`.

## 5. Kiểm tra bảng

Trong Neon **SQL Editor**, chạy:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

Kết quả mong đợi: `users`, `orders`, `entitlements`, `webhook_events`, `schema_migrations`.

## 6. Dev vs Production

| Môi trường | Gợi ý |
|------------|-------|
| Local dev | Branch `main` hoặc branch `dev` trên Neon |
| Render prod | Branch riêng hoặc project riêng |
| Secret | Chỉ đặt `DATABASE_URL` trên Render env, không commit |

## 7. Lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|------------|
| `ECONNREFUSED` | Sai host hoặc Neon project bị suspend — mở Dashboard wake DB |
| `SSL required` | Thêm `?sslmode=require` vào cuối URL |
| `password authentication failed` | Reset password trong Neon → copy URL mới |
| Migration lỗi duplicate | Bảng đã tồn tại — OK, `schema_migrations` sẽ skip file đã chạy |
