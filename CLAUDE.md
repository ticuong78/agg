# CLAUDE.md: quy tắc làm việc trong repo này

Sản phẩm một tính năng: đề lập trình vào, tệp Themis `.contest` ra. pnpm monorepo, Node 24, TypeScript.
Đọc `docs/ARCHITECTURE.md` trước khi sửa code.

## Lệnh

```bash
pnpm install
pnpm build:contracts        # trước khi typecheck API/web
pnpm dev:api | pnpm dev:web
pnpm typecheck && pnpm test
pnpm infra:test:up && pnpm test:integration   # migration, DB tạm cổng 55433
# Sau khi sửa entity: sinh migration trên DB tạm (không dùng DB dev, có thể đã chạy DB_SYNC)
DATABASE_URL=postgres://agg:agg@127.0.0.1:55433/agg_test pnpm --filter @agg/api migration:run
DATABASE_URL=postgres://agg:agg@127.0.0.1:55433/agg_test pnpm --filter @agg/api migration:generate src/migrations/<tên>
```

## Workflow

1. `docs/ai-engineering-playbook.md` là quy trình làm việc (spec, xác minh, review, vùng rủi ro); `docs/session-brief.md` là phạm vi MVP và thứ tự công việc; `docs/adr/` ghi các quyết định kiến trúc. Các tệp này cùng các skill `/spec`, `/review`, `/security-audit` và agent `reviewer`, `security-verifier` trong `.claude/` cũng là quy tắc.
2. Mọi thay đổi, kể cả tài liệu và công cụ, bắt đầu bằng spec `docs/specs/GD-<n>-<slug>.md` (dùng `/spec`; GD-0 đến GD-8 dành cho các bước của brief); trình bày rồi dừng cho tới khi chủ dự án duyệt.
3. Assistant không chạy `git add`, `git commit`, `git push`, không tạo branch hay PR: đưa lệnh để chủ dự án tự chạy. Hỏi trước khi thêm hoặc đổi dependency.
4. Gate trước khi báo xong: `pnpm build:contracts && pnpm typecheck && pnpm test` (thêm `pnpm infra:test:up && pnpm test:integration` khi đổi entity hoặc `migrations/**`), kèm dòng tóm tắt kết quả; kiểm tra trên trình duyệt với mọi thứ giáo viên nhìn thấy và nói rõ phần nào chưa kiểm tra.
5. MVP: không thêm lời gọi AI, prompt hay dependency Anthropic; mọi route chạy được khi không có `ANTHROPIC_API_KEY`.
6. Không đọc, in hay commit tệp `.env` hoặc khoá; chỉ dùng `.env.example` làm mẫu.
7. CI (`.github/workflows/ci.yml`, job `verify`) chạy quét secret (gitleaks), gate, test migration và commitlint trên mọi PR; `pr-text.yml` (job `pr-text`) kiểm tra tiêu đề và mô tả PR; chỉ merge khi `verify` và `pr-text` xanh. Đổi CI cần spec ghi rõ là đổi CI; action ghim theo SHA, không dùng `pull_request_target`, không đưa `${{ }}` từ PR vào script.
8. Muốn làm khác spec đã duyệt: đề xuất với chủ dự án và chờ đồng ý rồi mới làm, sau đó ghi vào spec. Khi xong, điền mục Measures của spec.
9. Trước khi đưa lệnh git: chạy `.github/scripts/secret-scan.sh tree` trên một bản sao tạm của các tệp sắp bàn giao (không chạy trên cây làm việc có tệp `.env`), báo kết quả.
10. Lệnh bị `.claude/settings.json` từ chối thì hỏi, không chạy vòng qua script hay wrapper (`bash -c`, `node -e`...).

## Kiến trúc (bắt buộc)

1. Bounded context ở `apps/api/src/modules/<context>` với 4 tầng `domain` / `application` / `infrastructure` / `presentation`. Domain không import NestJS, TypeORM hay infrastructure.
2. Chiều phụ thuộc: `growth -> billing -> identity`, `conversion -> billing`. Ngược chiều thì dùng domain event (`<context>.events.ts`).
3. Gọi context khác chỉ qua facade của nó, đặt sau port cục bộ (anti-corruption layer).
4. Repository là abstract class trong `domain/`, cài đặt TypeORM trong `infrastructure/`.
5. Lỗi: ném `DomainError`; `message` tiếng Việt cho người dùng, `code` tiếng Anh ổn định. Hết lượt/thiếu credit/khoá tính năng = `paymentRequired` với `details.action`.
6. Contracts trước: DTO, enum, bảng giá mới vào `packages/contracts`, rồi `pnpm build:contracts`.
7. Mọi con số về giá, giới hạn, credit chỉ nằm ở `packages/contracts/src/plans.ts`. Lời hứa trên trang giá phải đúng với các con số đó.

## Bảo mật và dữ liệu

1. Mọi route khai báo `@Access(...)`; guard từ chối route không khai báo. Route thuộc MVP thêm `@Mvp()`; thiếu thì route trả 404 khi `APP_MODE=mvp` (mặc định, GD-3, ADR 0003). Thêm route vào MVP là quyết định sản phẩm: cập nhật danh sách trong `test/mvp-mode.test.ts` và spec.
2. Mọi truy vấn theo id kiểm tra quyền (`Conversion.canBeOpenedBy`); không mở được thì 404.
3. Không bao giờ lưu tệp gốc tải lên. Không log email đầy đủ, mã đăng nhập, token, khoá truy cập.
4. Dữ liệu mới về người dùng phải: có trong trang Quyền riêng tư, có thời hạn lưu, bị xoá khi hết hạn, và bị xoá trong handler `AccountDeleted` của context đó khi gắn với tài khoản.
5. Thống kê chỉ lưu khi có đồng ý (`analyticsConsent`); lead chỉ xuất CSV người đồng ý tiếp thị (mặc định).
6. Webhook thanh toán: gateway tự xác thực chữ ký; đơn chỉ được trả một lần, đúng số tiền (`Order.markPaid`).

## AI

Adapter ở `conversion/infrastructure/claude-*.ts`, model từ `.env`, prompt có version, nội dung người dùng trong thẻ riêng, parse bằng zod. Không có key thì tính năng tắt, không crash. AI lỗi thì không trừ credit.

## Quy ước

TypeScript strict, ESM `.js` suffix trong API, test `node --test` ở `apps/api/test/*.test.ts` (kiểm tra bất biến trên aggregate, và route: guard cùng metadata của controller như `mvp-mode.test.ts`, hoặc qua HTTP với app thật như `mvp-mode.integration.test.ts`, khởi động từ `dist/` vì tsx không sinh metadata cho DI); test cần DB là `*.integration.test.ts`, chỉ chạy với `TEST_DATABASE_URL` trỏ vào DB tạm. Mọi thay đổi entity đi kèm migration sinh bằng `migration:generate`, thêm vào `migrations/index.ts`; không dùng `DB_SYNC` ngoài DB local dùng một lần. Comment giải thích *vì sao*. Chuỗi hiển thị tiếng Việt; code, comment, tài liệu kỹ thuật tiếng Anh hoặc tiếng Việt nhất quán theo tệp.
