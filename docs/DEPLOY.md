# Triển khai

## API trên VPS (Docker + Caddy)

Yêu cầu: VPS Linux có Docker, một tên miền con trỏ về VPS (ví dụ `api.example.com`), cổng 80/443 mở.

1. Sao chép repo lên VPS (ví dụ `/opt/agg`).
2. Tạo `deploy/api.env` từ `apps/api/.env.example` và điền:
   - `APP_MODE` (`mvp` mặc định hoặc `full`; xem mục Chế độ MVP), `NODE_ENV=production`, `JWT_SECRET`, `IP_HASH_SECRET` (mỗi cái `openssl rand -hex 32`)
   - `ADMIN_EMAILS`, `FRONTEND_URL=https://<tên miền web>`, `PUBLIC_API_URL=https://api.example.com`, `CORS_ORIGINS=https://<tên miền web>`
   - `SMTP_*` (bắt buộc khi `APP_MODE=full`: mã đăng nhập gửi qua email), `MAIL_FROM`, `SALES_NOTIFY_EMAIL`
   - `ANTHROPIC_API_KEY`, các `CLAUDE_*` model (chỉ dùng khi `APP_MODE=full`; ở chế độ MVP bị bỏ qua)
   - Khoá các cổng thanh toán muốn bật
   - `DB_SYNC=false` (bắt buộc: production từ chối `DB_SYNC=true`). Bảng do migration tạo, xem mục "Cơ sở dữ liệu và nâng cấp".
3. Chạy:

```bash
POSTGRES_PASSWORD=$(openssl rand -hex 24) API_DOMAIN=api.example.com docker compose -f deploy/docker-compose.yml up -d --build
```

Lưu `POSTGRES_PASSWORD` vào một tệp `.env` cạnh `deploy/docker-compose.yml` để các lần chạy sau dùng lại.

4. Kiểm tra: `curl https://api.example.com/api/health` → `{"ok":true}`. Khi khởi động, API tự chạy migration trước khi nhận request.
5. Sao lưu hằng đêm: thêm `deploy/backup.sh` vào crontab.

Caddy tự lấy chứng chỉ HTTPS, đặt `read_timeout` 5 phút cho tác vụ gợi ý test, và giới hạn kích thước request. API tin đúng 1 proxy (`TRUST_PROXY=1`) để đếm lượt theo IP thật.

## Chế độ MVP (`APP_MODE`)

Một công tắc cho mọi thứ ngoài MVP (GD-3, [ADR 0003](adr/0003-mvp-mode-allowlist.md)).

- **`APP_MODE=mvp`** (mặc định khi để trống): chỉ mở đường dành cho khách: tải lên hoặc dán đề, xem lại, xuất `.contest`. Tài khoản, thanh toán và webhook, growth, phần thưởng, quản trị, AI và xuất Word/PDF/Markdown trả 404. AI tắt kể cả khi có `ANTHROPIC_API_KEY`. Không cần `SMTP_HOST`.
- **`APP_MODE=full`**: mở mọi tính năng như trước GD-3; production khi đó cần `SMTP_HOST`.
- Giá trị khác (ví dụ `beta`) làm API dừng khi khởi động.
- **Web:** đặt `NEXT_PUBLIC_APP_MODE` cùng giá trị trên Vercel. Giá trị này được ghi vào bản build, nên đổi chế độ cần deploy lại web. Nếu hai bên lệch nhau, API quyết định: web có thể hiện một nút mà API từ chối, nhưng không bao giờ mở được thứ API đã đóng.

## Cơ sở dữ liệu và nâng cấp

Schema đến từ migration trong `apps/api/src/migrations/` (GD-1, ADR 0002), không từ `DB_SYNC`.

- **Khởi động:** API chạy mọi migration còn thiếu trong một transaction, dưới advisory lock của PostgreSQL, trước khi module nào đọc DB. Nhiều tiến trình khởi động cùng lúc thì chờ nhau (tối đa 10 phút). Migration lỗi thì DB giữ nguyên và API dừng, không thử lại.
- **Nâng cấp:** sao lưu (`deploy/backup.sh`), rồi deploy như bước 3. Không ai chạy SQL bằng tay.
- **DB đã tạo bằng `DB_SYNC` trước GD-1:** sao lưu, rồi chạy `migration:check` trên một bản sao của DB đó (không phải DB thật). Nếu báo "No changes", deploy: migration đầu (baseline) dùng `IF NOT EXISTS`, nên chỉ ghi nhận là đã chạy, dữ liệu giữ nguyên. Nếu báo khác biệt, dừng lại và viết migration cho phần khác biệt trước.
- **Lệnh** (chạy trong `apps/api`, đọc `DATABASE_URL` từ môi trường hoặc `.env`): `pnpm migration:show`, `pnpm migration:run`, `pnpm migration:revert` (huỷ migration cuối; baseline không huỷ được), `pnpm migration:check` (báo lỗi khi entity và migration khác nhau).
- **Đổi schema:** sửa entity, rồi sinh migration trên DB tạm (`pnpm infra:test:up`), không trên DB dev vì DB đó có thể đã chạy `DB_SYNC`: `DATABASE_URL=postgres://agg:agg@127.0.0.1:55433/agg_test pnpm migration:run`, rồi `DATABASE_URL=postgres://agg:agg@127.0.0.1:55433/agg_test pnpm migration:generate src/migrations/<tên>`. Thêm migration vào `migrations/index.ts`, chạy `pnpm test:integration`, review SQL trong cùng PR.
- **Trên VPS:** image production không có `tsx` (devDependency), nên các lệnh `pnpm migration:*` không chạy trong container. Dùng bản đã build: `docker compose -f deploy/docker-compose.yml exec api node dist/migrate.js run` (hoặc `revert`). Thường không cần `run`: API tự chạy migration khi khởi động.
- **Quay lại:** `migration:revert` (trên VPS: `node dist/migrate.js revert` như trên) cho migration sau baseline; với baseline, khôi phục bản sao lưu.

## Web trên Vercel

1. Import repo vào Vercel, **Root Directory = `apps/web`** (Vercel nhận pnpm workspace; `apps/web/vercel.json` đã đặt lệnh build).
2. Biến môi trường: `NEXT_PUBLIC_API_URL=https://api.example.com`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BRAND`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_APP_MODE` (cùng giá trị với `APP_MODE` của API; xem mục Chế độ MVP).
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

- [ ] Ở chế độ MVP: chỉ mở cho người dùng sau khi có trang Quyền riêng tư bản MVP (GD-7). Trang `/privacy` hiện tại vẫn mô tả tài khoản, thanh toán và việc gửi đề cho Anthropic, những thứ MVP không làm.
- [ ] Xác minh định dạng `.contest` với Themis thật (xem [THEMIS-FORMAT.md](THEMIS-FORMAT.md)).
- [ ] Nhờ luật sư rà soát trang Quyền riêng tư, Bảo vệ dữ liệu, Điều khoản (tên pháp nhân, địa chỉ, người phụ trách bảo vệ dữ liệu, hồ sơ chuyển dữ liệu ra nước ngoài theo pháp luật hiện hành).
- [ ] Đăng ký nhận diện thương hiệu / tên miền; thay `GóiĐề` nếu chọn tên khác (`NEXT_PUBLIC_BRAND`).
- [ ] Có bản sao lưu trước lần chạy migration đầu tiên trên production.
