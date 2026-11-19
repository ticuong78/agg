# GóiĐề — Đề lập trình vào, Themis ra

Giáo viên tải lên đề bài lập trình (PDF, Word, ảnh, văn bản, hoặc dán nội dung). AI tách từng bài, giáo viên chỉnh sửa (viết lại đề, gợi ý test có chạy code kiểm chứng), rồi xuất tệp **.contest** mở thẳng bằng Themis, kèm đề bài dạng `.docx`, `.doc`, `.pdf`, `.md`.

- Khách (chưa đăng nhập): PDF/Word/văn bản → .contest, 3 lượt/ngày.
- Đăng nhập (miễn phí, chỉ cần email): đọc ảnh/PDF scan, AI viết lại, gợi ý test, xuất Word/PDF.
- 3 gói trả phí: **Giáo viên**, **Tổ chuyên môn**, **Doanh nghiệp**; mua thêm credit; kiếm credit qua khảo sát, giới thiệu, góp ý, báo lỗi.

Tài liệu: [kiến trúc](docs/ARCHITECTURE.md) · [gói và tăng trưởng](docs/PRODUCT.md) · [định dạng Themis](docs/THEMIS-FORMAT.md) · [triển khai](docs/DEPLOY.md).

## Cấu trúc

```
packages/contracts   DTO, enum, bảng giá dùng chung
apps/api             NestJS (DDD: identity, conversion, billing, growth) → VPS
apps/web             Next.js → Vercel
deploy/              Dockerfile API, docker compose (Postgres + API + Caddy), backup
```

## Chạy trên máy

Cần Node 24, pnpm 12, Docker (cho PostgreSQL).

```bash
pnpm install
```

```bash
pnpm infra:up
```

```bash
cp apps/api/.env.example apps/api/.env
```

Trong `apps/api/.env`: điền `JWT_SECRET` (`openssl rand -hex 32`), email của bạn vào `ADMIN_EMAILS`, và `ANTHROPIC_API_KEY` nếu muốn dùng AI (không có key: bộ đọc theo luật vẫn chạy, tính năng AI tắt). Giữ `DB_SYNC=false`: API tự tạo và nâng cấp bảng bằng migration khi khởi động (xem `docs/DEPLOY.md`, "Cơ sở dữ liệu và nâng cấp").

```bash
cp apps/web/.env.example apps/web/.env.local
```

```bash
pnpm build:contracts
```

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

Mở http://localhost:3000. Không cấu hình SMTP thì mã đăng nhập được in ra log của API.

Kiểm thử tích hợp (migration, cần Docker; DB tạm ở cổng 55433, dữ liệu chỉ nằm trong bộ nhớ):

```bash
pnpm infra:test:up
```

```bash
pnpm test:integration
```

## Kiểm tra

CI (`.github/workflows/ci.yml`, job `verify`) quét secret bằng gitleaks (mọi commit, nội dung commit và cây tệp), rồi chạy `pnpm build:contracts`, `pnpm typecheck`, `pnpm test`, kiểm thử tích hợp và `migration:check` trên mọi PR và mọi lần push lên `main`; commitlint trên các commit chỉ chạy trên PR. `.github/workflows/pr-text.yml` (job `pr-text`) kiểm tra tiêu đề PR bằng commitlint và quét secret trong tiêu đề, mô tả PR, chạy lại khi chúng được sửa.

```bash
pnpm build:contracts && pnpm typecheck && pnpm test
```
