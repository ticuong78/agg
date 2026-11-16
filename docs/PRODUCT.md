# Sản phẩm: gói, credit, thưởng, thu thập lead

Mọi con số nằm ở **một chỗ**: `packages/contracts/src/plans.ts`. Trang Bảng giá đọc trực tiếp từ đó, API kiểm soát theo đó.

## Nguyên tắc

- **Tài liệu văn bản vào → .contest ra là miễn phí** cho mọi người (giới hạn lượt/ngày). Đây là cửa vào sản phẩm; không bao giờ để tài khoản đã đăng nhập thiệt hơn khách.
- Thứ tốn tiền thật (AI đọc ảnh/scan, viết lại, gợi ý test có chạy code) tính bằng **credit**.
- Xuất file luôn miễn phí.

## Các mức

| | Khách | Miễn phí | **Giáo viên** | **Tổ chuyên môn** | **Doanh nghiệp** |
|---|---|---|---|---|---|
| Giá | 0 | 0 | 99.000đ/tháng · 990.000đ/năm | 1.290.000đ/tháng · 12.900.000đ/năm | Liên hệ |
| Credit/tháng | – | 30 khi đăng ký + nạp lại tới 30 (10/tháng) | 400 | 8.000 dùng chung | Theo hợp đồng (mặc định 50.000) |
| Lượt chuyển đổi văn bản | 3/ngày | 10/ngày | Không giới hạn | Không giới hạn | Không giới hạn |
| Tệp/lần · MB/tệp · bài/bộ đề | 1 · 5 · 10 | 3 · 10 · 20 | 10 · 25 · 50 | 30 · 50 · 100 | 100 · 100 · 300 |
| Ảnh/scan, AI viết lại, gợi ý test | – | ✓ | ✓ | ✓ | ✓ |
| Xuất .docx/.doc/.pdf | – | ✓ | ✓ | ✓ | ✓ |
| Ưu tiên xử lý | – | – | ✓ | ✓ | ✓ |
| Thành viên | – | – | 1 | 15 (+49.000đ/người/tháng) | Không giới hạn |
| In tên trường lên đề | – | – | – | ✓ | ✓ |
| Hoá đơn VAT, chuyển khoản, Zalo | – | – | – | ✓ | ✓ |
| API, SSO, triển khai riêng, DPA, SLA | – | – | – | – | ✓ |
| Lưu bộ đề | 24 giờ | 30 ngày | 1 năm | 2 năm | 5 năm |

Vì sao khách hàng muốn lên mức cao hơn:

- **Giáo viên → Tổ chuyên môn**: mỗi credit rẻ hơn 35% (1.290.000đ / 8.000 = 161đ so với 99.000đ / 400 = 248đ), cả tổ dùng chung, tên trường in sẵn, hoá đơn VAT (trường công **bắt buộc** phải có để thanh toán).
- **Tổ chuyên môn → Doanh nghiệp**: Sở/Phòng cần SSO, hợp đồng xử lý dữ liệu, dữ liệu trong hạ tầng của mình, API nối vào hệ thống thi.


### Chi phí credit

| Thao tác | Credit |
|---|---|
| Chuyển tài liệu văn bản → bộ đề | 0 |
| Đọc 1 ảnh / 1 trang PDF scan | 1 |
| Viết lại 1 mục (tên bài, đề, dữ liệu vào, kết quả, ràng buộc) | 1 |
| Gợi ý 1 lượt test (tới 10 test, có chạy code kiểm chứng) | 3 |
| Xuất mọi định dạng | 0 |

Thao tác AI lỗi không bị trừ credit. Credit gói hết hạn sau 60 ngày (cộng dồn 1 tháng), credit mua thêm 12 tháng, credit thưởng/chào mừng không hết hạn. Ví tiêu credit sắp hết hạn trước.

### Gói mua thêm

100 credit 49.000đ · 500 credit 199.000đ · 2.000 credit 690.000đ.

## Thanh toán

Trả trước, không tự gia hạn (VNPay, MoMo, chuyển khoản không có trả định kỳ đơn giản). Mua lại cùng gói khi còn hạn → cộng dồn thời gian; nâng cấp → gói mới bắt đầu ngay.

| Cổng | Cách hoạt động | Biến môi trường |
|---|---|---|
| VietQR | Hiện mã QR (ngân hàng, số tiền, nội dung `GDxxxxxxxx`). SePay báo tiền về qua webhook | `VIETQR_*`, `SEPAY_WEBHOOK_KEY` |
| MoMo | API v2 `captureWallet`, IPN ký HMAC-SHA256 | `MOMO_*` |
| VNPay | API 2.1.0, URL ký HMAC-SHA512, IPN (GET) | `VNPAY_*` |
| Stripe | Checkout Session (VND), webhook `checkout.session.completed` | `STRIPE_*` |

Webhook: `POST|GET {PUBLIC_API_URL}/api/billing/webhooks/{vnpay|momo|stripe|vietqr}`. Cổng nào thiếu biến môi trường thì hiện "Sắp có".

## Thưởng credit

| Hoạt động | Credit | Điều kiện |
|---|---|---|
| Khảo sát | 20 | Một lần. **Đồng thời là biểu mẫu lead chính** (vai trò, trường, tỉnh, số học sinh, công cụ đang dùng, tính năng muốn có, SĐT nếu đồng ý) |
| Giới thiệu | 30 cho người giới thiệu, 10 cho người được giới thiệu | Người được giới thiệu phải hoàn thành 1 bộ đề; tối đa 20 người/30 ngày |
| Góp ý | 5 | ≥ 20 ký tự, mỗi 30 ngày |
| Báo lỗi | 10–50 | Admin duyệt và chọn mức |
| Phỏng vấn người dùng | 50 | Admin duyệt sau buổi trò chuyện |

Không có beta testing (theo yêu cầu).

## Thu thập dữ liệu và lead

| Nguồn | Khi nào | Dữ liệu |
|---|---|---|
| Visitor | Mọi lượt vào (cần thiết) | id ngẫu nhiên, trang vào, referrer, utm, trình duyệt, IP băm, quốc gia (nếu sau Cloudflare) |
| Thống kê | Chỉ khi đồng ý | page view, sự kiện |
| Email của khách | Sau lần xuất đầu tiên ("nhận mẹo dùng Themis") | email, đồng ý tiếp thị |
| Đăng ký | Lần đăng nhập đầu | email, tên, đồng ý tiếp thị, visitor → tài khoản |
| Khảo sát, liên hệ tư vấn, phỏng vấn | Khi gửi | như trên |

Tất cả gộp về **một lead theo email** (`growth/domain/lead.ts`) với danh sách nguồn. Admin xem tại `/admin`, tải CSV (mặc định chỉ người đồng ý tiếp thị; CSV chống công thức Excel).
