# Kiến trúc

## Tổng quan

```
Trình duyệt ──HTTPS──> Next.js (Vercel)         chỉ giao diện; không có logic nghiệp vụ
     │
     └────HTTPS──> Caddy ──> NestJS API (VPS) ──> PostgreSQL (VPS)
                                   │
                                   ├──> Anthropic Claude API   (đọc đề, viết lại, gợi ý test)
                                   ├──> SMTP                   (mã đăng nhập, lời mời)
                                   └──> Stripe / VNPay / MoMo / SePay (thanh toán + webhook)
```

Trình duyệt gọi thẳng API trên VPS (CORS), nên tác vụ AI dài (gợi ý test có chạy code, 1–3 phút) không bị giới hạn thời gian của serverless Vercel.

Monorepo pnpm:

| Package | Đường dẫn | Vai trò |
|---|---|---|
| `@agg/contracts` | `packages/contracts` | DTO, enum, **bảng giá/tier/chi phí credit** dùng chung cho API và web |
| `@agg/api` | `apps/api` | NestJS, DDD, TypeORM/PostgreSQL |
| `@agg/web` | `apps/web` | Next.js App Router, Tailwind 4 |

## DDD: bounded context

Mỗi context nằm ở `apps/api/src/modules/<context>/` với 4 tầng:

- `domain/` — aggregate, value object, domain service, repository dạng abstract class. Không biết NestJS, TypeORM hay HTTP.
- `application/` — use case (service), facade công bố cho context khác, port (abstract class) ra bên ngoài.
- `infrastructure/` — TypeORM entity + repository, adapter Claude, cổng thanh toán, exporter, adapter sang context khác.
- `presentation/` — controller, DTO có class-validator.

| Context | Trách nhiệm | Aggregate chính |
|---|---|---|
| **identity** | Đăng nhập bằng mã email, tài khoản, mã giới thiệu, quyền admin, xoá tài khoản | `User`, `SignInCode` |
| **conversion** | Lõi sản phẩm: tải lên → tách bài (AI hoặc parser) → chỉnh sửa → xuất | `Conversion` (chứa entity `Problem`, value object `TestCase`, `TaskCode`) |
| **billing** | Tier, giới hạn, lượt/ngày, ví credit, gói, đơn hàng, cổng thanh toán, workspace trường học | `Wallet`, `Subscription`, `Order`, `Workspace` |
| **growth** | Visitor + đồng ý (consent), lead, khảo sát, giới thiệu, góp ý, báo lỗi, phỏng vấn, thưởng credit, thống kê | `Visitor`, `Lead`, `RewardClaim`, `Referral` |

Chiều phụ thuộc (không bao giờ đi ngược):

```
growth ──> billing ──> identity
conversion ──> billing
```

Một context chỉ gọi context khác qua **facade** của context đó, đặt sau một **port** cục bộ (anti-corruption layer):
`conversion/application/ports.ts#UsageGateway` → `conversion/infrastructure/billing.gateway.ts` → `BillingFacade`.

Phản ứng theo chiều ngược lại đi qua **domain event** (`@nestjs/event-emitter`):

| Sự kiện | Phát bởi | Ai phản ứng |
|---|---|---|
| `identity.user_registered` | identity | billing: credit chào mừng · growth: lead, gắn visitor, giới thiệu |
| `identity.account_deleted` | identity | conversion, billing, growth: xoá dữ liệu của người đó |
| `conversion.completed` | conversion | growth: giới thiệu đủ điều kiện → thưởng; thống kê phễu |
| `conversion.exported` | conversion | growth: thống kê phễu |
| `billing.order_paid` | billing | billing: kích hoạt gói / cộng credit |

## Luồng chính

### 1. Tải lên (bất đồng bộ)

`POST /api/conversions` (multipart) hoặc `/api/conversions/text`:

1. `classifySource` kiểm tra **byte đầu** của tệp, không tin đuôi tệp.
2. Đọc lớp chữ ngay (mammoth cho docx, unpdf cho pdf). PDF gần như không có chữ → coi là **scan**.
3. Kiểm tra tier: số tệp, dung lượng, ảnh/scan cần tài khoản, đủ credit cho số trang ảnh, lượt/ngày (khách: theo visitor và theo mạng; tài khoản miễn phí: theo tài khoản).
4. Tạo `Conversion` trạng thái `PROCESSING`, trả về ngay (khách nhận `accessKey` một lần).
5. Hàng đợi trong tiến trình (`InProcessJobQueue`, gói trả phí đi trước) chạy AI đọc từng nguồn; lỗi → parser theo luật (`ExamParser`, copy từ OnlineJudge). Chỉ trừ credit khi AI đã đọc ảnh/scan thành công.
6. Tệp gốc chỉ nằm trong bộ nhớ, không bao giờ ghi đĩa hay DB. API khởi động lại → bộ đề đang xử lý chuyển `FAILED`.

### 2. Chỉnh sửa

Sửa mục, giới hạn, mã bài, test (PATCH), sắp xếp bài, thiết lập bộ đề. AI viết lại một mục (1 credit) và gợi ý test có chạy code (3 credit) trả về **đề xuất**; giáo viên bấm "Dùng bản này" mới lưu.

### 3. Xuất

`GET /api/conversions/:id/export/:format` — `contest` và `md` cho mọi người; `docx`, `doc`, `pdf` cần tài khoản. Xem [THEMIS-FORMAT.md](THEMIS-FORMAT.md).

## Quyền truy cập

- Guard toàn cục `RequestGuard` (identity/presentation): **mọi route phải khai báo** `@Access('guest' | 'user' | 'admin' | 'webhook')`, thiếu là bị từ chối (fail closed).
- Mọi request có `Requester`: tài khoản (Bearer JWT) hoặc khách (`x-visitor-id` + IP đã băm HMAC).
- Bộ đề của khách mở bằng `x-access-key` (chỉ lưu SHA-256); bộ đề của tài khoản mở theo chủ sở hữu. Không mở được thì trả 404 (không lộ sự tồn tại).
- Webhook thanh toán không có phiên; từng gateway tự xác thực chữ ký (HMAC VNPay/MoMo, chữ ký Stripe trên raw body, API key SePay).

## Lỗi

Domain/application ném `DomainError` (kind → HTTP status, `code` tiếng Anh ổn định, `message` tiếng Việt). `402 payment_required` kèm `details.action = signin | upgrade`: frontend mở hộp thoại "Đăng nhập" hoặc "Nâng cấp" (`components/upgrade.tsx`).

## Quy tắc AI

- Adapter ở `conversion/infrastructure/claude-*.ts`, dùng `shared/infrastructure/claude.ts`; model lấy từ `.env`.
- Prompt là hằng số có version cạnh adapter; nội dung người dùng nằm trong thẻ `<tai_lieu>`, `<de_bai>`, `<mong_muon>` và prompt nói rõ đó là dữ liệu.
- Mọi phản hồi parse bằng zod (`betaZodOutputFormat`). Không có key → tính năng AI tắt, parser theo luật vẫn chạy.
- Test gợi ý chỉ được đánh dấu "đã kiểm chứng" khi model thực sự gọi công cụ code execution.

## Những gì cố ý chưa làm (để giữ bản lean)

- Hàng đợi phân tán (Redis/BullMQ): một VPS, một tiến trình là đủ ở giai đoạn đầu. Port `JobQueue` đã tách sẵn.
- Migration TypeORM: lần triển khai đầu dùng `DB_SYNC=true`; trước thay đổi schema tiếp theo nên sinh migration.
- Gia hạn tự động: VNPay/MoMo/chuyển khoản không hỗ trợ trả định kỳ đơn giản, nên gói là trả trước 1/12 tháng.
- SSO, API công khai cho gói Doanh nghiệp: hiện là cam kết bán hàng, chưa có code.
