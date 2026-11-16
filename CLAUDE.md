# CLAUDE.md: quy tắc làm việc trong repo này

Sản phẩm một tính năng: đề lập trình vào, tệp Themis `.contest` ra. pnpm monorepo, Node 24, TypeScript.
Đọc `docs/ARCHITECTURE.md` trước khi sửa code.

## Lệnh

```bash
pnpm install
pnpm build:contracts        # trước khi typecheck API/web
pnpm dev:api | pnpm dev:web
pnpm typecheck && pnpm test
```

## Kiến trúc (bắt buộc)

1. Bounded context ở `apps/api/src/modules/<context>` với 4 tầng `domain` / `application` / `infrastructure` / `presentation`. Domain không import NestJS, TypeORM hay infrastructure.
2. Chiều phụ thuộc: `growth -> billing -> identity`, `conversion -> billing`. Ngược chiều thì dùng domain event (`<context>.events.ts`).
3. Gọi context khác chỉ qua facade của nó, đặt sau port cục bộ (anti-corruption layer).
4. Repository là abstract class trong `domain/`, cài đặt TypeORM trong `infrastructure/`.
5. Lỗi: ném `DomainError`; `message` tiếng Việt cho người dùng, `code` tiếng Anh ổn định. Hết lượt/thiếu credit/khoá tính năng = `paymentRequired` với `details.action`.
6. Contracts trước: DTO, enum, bảng giá mới vào `packages/contracts`, rồi `pnpm build:contracts`.
7. Mọi con số về giá, giới hạn, credit chỉ nằm ở `packages/contracts/src/plans.ts`. Lời hứa trên trang giá phải đúng với các con số đó.

## Bảo mật và dữ liệu

1. Mọi route khai báo `@Access(...)`; guard từ chối route không khai báo.
2. Mọi truy vấn theo id kiểm tra quyền (`Conversion.canBeOpenedBy`); không mở được thì 404.
3. Không bao giờ lưu tệp gốc tải lên. Không log email đầy đủ, mã đăng nhập, token, khoá truy cập.
4. Dữ liệu mới về người dùng phải: có trong trang Quyền riêng tư, có thời hạn lưu, và bị xoá trong handler `AccountDeleted` của context đó.
5. Thống kê chỉ lưu khi có đồng ý (`analyticsConsent`); lead chỉ xuất CSV người đồng ý tiếp thị (mặc định).
6. Webhook thanh toán: gateway tự xác thực chữ ký; đơn chỉ được trả một lần, đúng số tiền (`Order.markPaid`).

## AI

Adapter ở `conversion/infrastructure/claude-*.ts`, model từ `.env`, prompt có version, nội dung người dùng trong thẻ riêng, parse bằng zod. Không có key thì tính năng tắt, không crash. AI lỗi thì không trừ credit.

## Quy ước

TypeScript strict, ESM `.js` suffix trong API, test `node --test` ở `apps/api/test/*.test.ts` (kiểm tra bất biến trên aggregate). Comment giải thích *vì sao*. Chuỗi hiển thị tiếng Việt; code, comment, tài liệu kỹ thuật tiếng Anh hoặc tiếng Việt nhất quán theo tệp.
