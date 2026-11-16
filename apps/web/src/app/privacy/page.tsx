'use client';

import { LegalPage, Section } from '@/components/legal';
import { Button } from '@/components/ui';
import { BRAND, SUPPORT_EMAIL } from '@/lib/config';
import { useTracking } from '@/lib/tracking';

const TOC: [string, string][] = [
  ['tom-tat', 'Tóm tắt'], ['thu-thap', 'Dữ liệu chúng tôi thu thập'], ['muc-dich', 'Mục đích và căn cứ'],
  ['luu-tru', 'Thời gian lưu trữ'], ['chia-se', 'Bên nhận dữ liệu'], ['cookie', 'Bộ nhớ trình duyệt và thống kê'],
  ['tiep-thi', 'Liên hệ tiếp thị'], ['tre-em', 'Học sinh và trẻ em'], ['lien-he', 'Liên hệ'],
];

export default function PrivacyPage() {
  const { consent, decide } = useTracking();
  return (
    <LegalPage
      title="Chính sách quyền riêng tư"
      current="/privacy"
      toc={TOC}
      intro={<>
        <p><strong>Tóm tắt ngắn:</strong> chúng tôi chỉ thu thập những gì cần để chuyển đề của bạn sang Themis, giữ tài khoản và thanh toán.
          Tệp gốc bạn tải lên <strong>không bao giờ được lưu</strong>. Nội dung đề <strong>không được dùng để huấn luyện AI</strong>.
          Thống kê sử dụng và email tiếp thị chỉ khi bạn đồng ý, và bạn có thể rút lại bất cứ lúc nào.</p>
      </>}
    >
      <Section id="tom-tat" title="1. Tóm tắt">
        <ul>
          <li>Bạn dùng được {BRAND} không cần tài khoản. Khi đó chúng tôi chỉ biết một mã ngẫu nhiên do trình duyệt của bạn tạo ra.</li>
          <li>Khi đăng ký, chúng tôi biết email và tên hiển thị bạn nhập. Không có mật khẩu để lộ.</li>
          <li>Không bán dữ liệu cá nhân. Không dùng công cụ quảng cáo hay theo dõi của bên thứ ba trên trang.</li>
        </ul>
      </Section>

      <Section id="thu-thap" title="2. Dữ liệu chúng tôi thu thập">
        <table>
          <thead><tr><th>Loại</th><th>Ví dụ</th><th>Khi nào</th></tr></thead>
          <tbody>
            <tr><td>Nội dung đề bài</td><td>Tệp PDF, Word, ảnh, văn bản bạn tải lên; bộ đề đã tách (đề, test, giới hạn)</td><td>Khi bạn chuyển đổi. Tệp gốc chỉ nằm trong bộ nhớ máy chủ trong lúc xử lý rồi bị huỷ; chỉ kết quả có cấu trúc được lưu.</td></tr>
            <tr><td>Định danh trình duyệt</td><td>Mã ngẫu nhiên lưu trong trình duyệt, trang đầu tiên bạn vào, trang giới thiệu, tham số chiến dịch (utm), loại trình duyệt, ngôn ngữ</td><td>Mọi lượt truy cập (cần thiết để tính lượt miễn phí và chống lạm dụng).</td></tr>
            <tr><td>Địa chỉ mạng</td><td>Chỉ lưu dạng <em>băm có khoá</em>, không khôi phục được địa chỉ IP gốc</td><td>Mọi yêu cầu, để giới hạn lượt dùng và chặn lạm dụng.</td></tr>
            <tr><td>Tài khoản</td><td>Email, tên hiển thị, mã giới thiệu, lựa chọn nhận tiếp thị</td><td>Khi đăng ký / đăng nhập.</td></tr>
            <tr><td>Thông tin bạn tự cung cấp</td><td>Câu trả lời khảo sát (vai trò, trường, tỉnh, số học sinh...), số điện thoại, góp ý, báo lỗi, biểu mẫu liên hệ tư vấn, email để nhận tin</td><td>Chỉ khi bạn gửi các biểu mẫu đó.</td></tr>
            <tr><td>Thanh toán</td><td>Mã đơn, gói, số tiền, cổng thanh toán, mã giao dịch</td><td>Khi mua gói. Số thẻ, tài khoản ngân hàng, ví do cổng thanh toán xử lý; chúng tôi không nhận và không lưu.</td></tr>
            <tr><td>Thống kê sử dụng</td><td>Trang đã xem, tính năng đã dùng</td><td>Chỉ khi bạn đồng ý “Thống kê sử dụng”.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="muc-dich" title="3. Mục đích và căn cứ xử lý">
        <ul>
          <li><strong>Cung cấp dịch vụ</strong> (đọc đề, tách bài, AI viết lại, gợi ý test, xuất tệp): thực hiện yêu cầu của bạn.</li>
          <li><strong>Lượt miễn phí, credit, chống lạm dụng, bảo mật</strong>: cần thiết để vận hành dịch vụ công bằng.</li>
          <li><strong>Thanh toán, hoá đơn, kế toán</strong>: thực hiện hợp đồng và nghĩa vụ pháp luật.</li>
          <li><strong>Cải thiện sản phẩm</strong> từ thống kê sử dụng: chỉ khi bạn đồng ý.</li>
          <li><strong>Gửi thông tin sản phẩm, ưu đãi; liên hệ tư vấn cho trường học</strong>: chỉ khi bạn đồng ý (ô đồng ý không được tích sẵn ở biểu mẫu đăng nhập).</li>
        </ul>
      </Section>

      <Section id="luu-tru" title="4. Thời gian lưu trữ">
        <table>
          <thead><tr><th>Dữ liệu</th><th>Thời gian</th></tr></thead>
          <tbody>
            <tr><td>Tệp gốc tải lên</td><td>Không lưu (huỷ ngay sau khi đọc)</td></tr>
            <tr><td>Bộ đề đã chuyển đổi</td><td>Khách: 24 giờ · Miễn phí: 30 ngày · Giáo viên: 1 năm · Tổ chuyên môn: 2 năm · Doanh nghiệp: theo hợp đồng. Tự động xoá khi hết hạn; bạn có thể xoá sớm hơn.</td></tr>
            <tr><td>Tài khoản, credit</td><td>Đến khi bạn xoá tài khoản</td></tr>
            <tr><td>Đơn hàng</td><td>Theo thời hạn lưu chứng từ kế toán của pháp luật Việt Nam</td></tr>
            <tr><td>Thông tin liên hệ tiếp thị (lead)</td><td>Đến khi bạn rút đồng ý hoặc yêu cầu xoá</td></tr>
            <tr><td>Thống kê sử dụng, định danh trình duyệt</td><td>Tối đa 24 tháng</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="chia-se" title="5. Bên nhận dữ liệu">
        <p>Chúng tôi chỉ chia sẻ dữ liệu với các nhà cung cấp cần thiết để vận hành dịch vụ, theo hợp đồng và chỉ cho đúng mục đích đó:</p>
        <ul>
          <li><strong>Anthropic</strong> (Hoa Kỳ) — mô hình AI Claude đọc đề, viết lại, gợi ý test. Nội dung đề được gửi qua API; theo điều khoản thương mại của Anthropic, dữ liệu API không được dùng để huấn luyện mô hình.</li>
          <li><strong>Vercel</strong> — lưu trữ giao diện web.</li>
          <li><strong>Nhà cung cấp máy chủ</strong> — nơi đặt máy chủ API và cơ sở dữ liệu.</li>
          <li><strong>Dịch vụ gửi email</strong> — gửi mã đăng nhập, lời mời, thông báo.</li>
          <li><strong>Cổng thanh toán</strong> (Stripe, VNPay, MoMo, ngân hàng và dịch vụ xác nhận chuyển khoản) — chỉ khi bạn chọn thanh toán qua cổng đó.</li>
        </ul>
        <p>Một số nhà cung cấp xử lý dữ liệu ngoài Việt Nam. Việc chuyển dữ liệu ra nước ngoài được thực hiện theo quy định của pháp luật Việt Nam về bảo vệ dữ liệu cá nhân. Chúng tôi không bán hay cho thuê dữ liệu cá nhân.</p>
      </Section>

      <Section id="cookie" title="6. Bộ nhớ trình duyệt và thống kê">
        <p>{BRAND} không dùng cookie quảng cáo hay công cụ theo dõi của bên thứ ba. Chúng tôi dùng bộ nhớ của trình duyệt (localStorage) cho:</p>
        <ul>
          <li><strong>Cần thiết</strong>: mã phiên đăng nhập, mã định danh trình duyệt (tính lượt miễn phí), khoá mở bộ đề của khách, lựa chọn quyền riêng tư của bạn.</li>
          <li><strong>Thống kê</strong> (tuỳ chọn): ghi nhận trang đã xem, tính năng đã dùng — chỉ gửi về máy chủ của chúng tôi.</li>
          <li><strong>Tiếp thị</strong> (tuỳ chọn): cho phép chúng tôi gửi thông tin sản phẩm.</li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line p-4">
          <p className="w-full text-sm">Lựa chọn hiện tại: thống kê <strong>{consent?.analytics ? 'bật' : 'tắt'}</strong>, tiếp thị <strong>{consent?.marketing ? 'bật' : 'tắt'}</strong>.</p>
          <Button size="sm" variant="secondary" onClick={() => decide(false, false)}>Chỉ cần thiết</Button>
          <Button size="sm" variant="secondary" onClick={() => decide(true, false)}>Bật thống kê</Button>
          <Button size="sm" onClick={() => decide(true, true)}>Bật tất cả</Button>
        </div>
      </Section>

      <Section id="tiep-thi" title="7. Liên hệ tiếp thị">
        <p>Nếu bạn đồng ý, chúng tôi có thể gửi email về tính năng mới, ưu đãi, và (nếu bạn để lại số điện thoại trong khảo sát hoặc biểu mẫu tư vấn) liên hệ về gói cho trường học. Mọi email đều có cách huỷ nhận; bạn cũng có thể tắt trong trang Tài khoản.</p>
      </Section>

      <Section id="tre-em" title="8. Học sinh và trẻ em">
        <p>{BRAND} dành cho giáo viên và người ra đề. Chúng tôi không chủ đích thu thập dữ liệu của học sinh dưới 16 tuổi. Đề bài không nên chứa thông tin cá nhân của học sinh; nếu có, hãy xoá trước khi tải lên.</p>
      </Section>

      <Section id="lien-he" title="9. Liên hệ">
        <p>Mọi câu hỏi, yêu cầu về dữ liệu cá nhân: <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Xem thêm quyền của bạn tại trang <a className="underline" href="/data-protection#quyen">Bảo vệ dữ liệu</a>.</p>
      </Section>
    </LegalPage>
  );
}
