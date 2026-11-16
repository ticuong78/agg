# Triển khai

## API trên VPS (Docker + Caddy)

Yêu cầu: VPS Linux có Docker, một tên miền con trỏ về VPS (ví dụ `api.example.com`), cổng 80/443 mở.

1. Sao chép repo lên VPS (ví dụ `/opt/agg`).
2. Tạo `deploy/api.env` từ `apps/api/.env.example` và điền:
   - `NODE_ENV=production`, `JWT_SECRET`, `IP_HASH_SECRET` (mỗi cái `openssl rand -hex 32`)
   - `ADMIN_EMAILS`, `FRONTEND_URL=https://<tên miền web>`, `PUBLIC_API_URL=https://api.example.com`, `CORS_ORIGINS=https://<tên miền web>`
   - `SMTP_*` (bắt buộc: mã đăng nhập gửi qua email), `MAIL_FROM`, `SALES_NOTIFY_EMAIL`
   - `ANTHROPIC_API_KEY`, các `CLAUDE_*` model
   - Khoá các cổng thanh toán muốn bật
   - Lần đầu: `DB_SYNC=true` để tạo bảng, sau đó đổi thành `false`.
3. Chạy:

```bash
POSTGRES_PASSWORD=$(openssl rand -hex 24) API_DOMAIN=api.example.com docker compose -f deploy/docker-compose.yml up -d --build
```

Lưu `POSTGRES_PASSWORD` vào một tệp `.env` cạnh `deploy/docker-compose.yml` để các lần chạy sau dùng lại.

4. Kiểm tra: `curl https://api.example.com/api/health` → `{"ok":true}`.
5. Sao lưu hằng đêm: thêm `deploy/backup.sh` vào crontab.

Caddy tự lấy chứng chỉ HTTPS, đặt `read_timeout` 5 phút cho tác vụ gợi ý test, và giới hạn kích thước request. API tin đúng 1 proxy (`TRUST_PROXY=1`) để đếm lượt theo IP thật.

## Web trên Vercel

1. Import repo vào Vercel, **Root Directory = `apps/web`** (Vercel nhận pnpm workspace; `apps/web/vercel.json` đã đặt lệnh build).
2. Biến môi trường: `NEXT_PUBLIC_API_URL=https://api.example.com`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BRAND`, `NEXT_PUBLIC_SUPPORT_EMAIL`.
3. Deploy. Sau đó cập nhật `FRONTEND_URL` và `CORS_ORIGINS` của API cho đúng tên miền web.

## Cổng thanh toán

Đặt URL thông báo (IPN/webhook) ở trang quản trị của từng cổng:

| Cổng | URL |
|---|---|
| VNPay | `https://api.example.com/api/billing/webhooks/vnpay` (IPN, GET) |
| MoMo | `https://api.example.com/api/billing/webhooks/momo` (gửi kèm mỗi giao dịch, không cần đăng ký) |
| Stripe | `https://api.example.com/api/billing/webhooks/stripe`, sự kiện `checkout.session.completed`, `checkout.session.async_payment_succeeded` |
| SePay (VietQR) | `https://api.example.com/api/billing/webhooks/vietqr`, xác thực "API Key" = `SEPAY_WEBHOOK_KEY` |

Thử trên sandbox VNPay/MoMo/Stripe test mode trước khi đổi sang khoá thật.

## Trước khi mở cho người dùng

- [ ] Xác minh định dạng `.contest` với Themis thật (xem [THEMIS-FORMAT.md](THEMIS-FORMAT.md)).
- [ ] Nhờ luật sư rà soát trang Quyền riêng tư, Bảo vệ dữ liệu, Điều khoản (tên pháp nhân, địa chỉ, người phụ trách bảo vệ dữ liệu, hồ sơ chuyển dữ liệu ra nước ngoài theo pháp luật hiện hành).
- [ ] Đăng ký nhận diện thương hiệu / tên miền; thay `GóiĐề` nếu chọn tên khác (`NEXT_PUBLIC_BRAND`).
- [ ] Tắt `DB_SYNC` sau lần triển khai đầu.
