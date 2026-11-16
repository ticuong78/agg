import type { Metadata } from 'next';
import { LegalPage, Section } from '@/components/legal';
import { BRAND, SUPPORT_EMAIL } from '@/lib/config';

export const metadata: Metadata = { title: 'Bảo vệ dữ liệu' };

const TOC: [string, string][] = [
  ['cam-ket', 'Cam kết của chúng tôi'], ['tai-lieu', 'Tài liệu của bạn'], ['ky-thuat', 'Biện pháp kỹ thuật'],
  ['ai', 'AI và dữ liệu của bạn'], ['quyen', 'Quyền của bạn'], ['su-co', 'Khi có sự cố'], ['truong-hoc', 'Cho trường học, tổ chức'],
];

export default function DataProtectionPage() {
  return (
    <LegalPage
      title="Bảo vệ dữ liệu"
      current="/data-protection"
      toc={TOC}
      intro={<p>Đề thi là công sức của thầy cô, và nhiều đề chưa được công bố. Chúng tôi thiết kế {BRAND} để <strong>giữ ít dữ liệu nhất có thể, trong thời gian ngắn nhất có thể</strong>, và để bạn luôn kiểm soát được dữ liệu của mình.</p>}
    >
      <Section id="cam-ket" title="1. Cam kết của chúng tôi">
        <ul>
          <li>Tệp gốc không bao giờ được ghi xuống đĩa hay lưu vào cơ sở dữ liệu.</li>
          <li>Bộ đề đã chuyển đổi chỉ người tạo mở được, và tự xoá theo thời hạn của gói.</li>
          <li>Nội dung đề không dùng để huấn luyện AI, không chia sẻ cho người dùng khác, không dùng cho quảng cáo.</li>
          <li>Không dùng công cụ theo dõi, quảng cáo của bên thứ ba trên trang.</li>
          <li>Xử lý dữ liệu cá nhân theo pháp luật Việt Nam về bảo vệ dữ liệu cá nhân.</li>
        </ul>
      </Section>

      <Section id="tai-lieu" title="2. Tài liệu của bạn đi qua những đâu">
        <ol className="ml-5 list-decimal space-y-2">
          <li>Trình duyệt gửi tệp tới máy chủ API qua kết nối mã hoá HTTPS.</li>
          <li>Máy chủ đọc phần chữ của tệp trong bộ nhớ. Nếu cần AI (đề dạng ảnh, PDF scan, hoặc để tách bài chính xác hơn), nội dung được gửi tới mô hình AI qua kết nối mã hoá.</li>
          <li>Kết quả có cấu trúc (tên bài, đề, test, giới hạn) được lưu; tệp gốc bị huỷ khi xử lý xong.</li>
          <li>Khách mở lại bộ đề bằng một khoá bí mật chỉ nằm trong trình duyệt đã tạo ra nó. Tài khoản mở bằng quyền sở hữu.</li>
          <li>Hết thời hạn lưu, bộ đề bị xoá hẳn khỏi cơ sở dữ liệu (không chỉ ẩn đi).</li>
        </ol>
      </Section>

      <Section id="ky-thuat" title="3. Biện pháp kỹ thuật">
        <ul>
          <li>Mã hoá đường truyền (HTTPS/TLS) giữa trình duyệt, máy chủ và các nhà cung cấp.</li>
          <li>Đăng nhập không mật khẩu: mã một lần chỉ lưu dạng băm, hết hạn sau 10 phút, khoá sau 5 lần nhập sai.</li>
          <li>Địa chỉ IP chỉ lưu dạng băm có khoá, không khôi phục được.</li>
          <li>Mọi đường dẫn API đều phải khai báo quyền truy cập; truy cập dữ liệu được kiểm tra theo chủ sở hữu.</li>
          <li>Kiểm tra nội dung tệp (không chỉ đuôi tệp), giới hạn kích thước, giới hạn tần suất để chống lạm dụng.</li>
          <li>Đường dẫn ngoài và lời mời vào nhóm trong đề được loại bỏ khi tách bài.</li>
          <li>Thông báo thanh toán từ cổng được xác thực chữ ký; mỗi đơn chỉ được ghi nhận một lần, đúng số tiền.</li>
        </ul>
      </Section>

      <Section id="ai" title="4. AI và dữ liệu của bạn">
        <p>{BRAND} dùng mô hình Claude của Anthropic qua API thương mại. Theo điều khoản của Anthropic, dữ liệu gửi qua API không được dùng để huấn luyện mô hình. Đầu ra của AI luôn được kiểm tra theo cấu trúc trước khi lưu, và luôn là <em>đề xuất</em>: bạn quyết định giữ hay bỏ. Test do AI gợi ý ghi rõ đã được chạy kiểm chứng hay chưa.</p>
      </Section>

      <Section id="quyen" title="5. Quyền của bạn">
        <p>Bạn có quyền được biết, đồng ý hoặc rút lại đồng ý, truy cập, chỉnh sửa, xoá, hạn chế xử lý, phản đối xử lý, yêu cầu cung cấp dữ liệu, khiếu nại và yêu cầu bồi thường theo quy định pháp luật. Cách thực hiện:</p>
        <table>
          <thead><tr><th>Bạn muốn</th><th>Cách làm</th></tr></thead>
          <tbody>
            <tr><td>Xoá một bộ đề</td><td>Mở bộ đề hoặc trang Tài khoản → Xoá. Có hiệu lực ngay.</td></tr>
            <tr><td>Xoá tài khoản và toàn bộ dữ liệu</td><td>Trang Tài khoản → “Xoá tài khoản và dữ liệu”. Hồ sơ, bộ đề, credit, câu trả lời khảo sát, lịch sử bị xoá ngay; đơn hàng được giữ theo luật kế toán.</td></tr>
            <tr><td>Rút đồng ý thống kê / tiếp thị</td><td>Trang Quyền riêng tư (mục Bộ nhớ trình duyệt) hoặc trang Tài khoản.</td></tr>
            <tr><td>Nhận bản sao dữ liệu, chỉnh sửa, khiếu nại</td><td>Email <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Chúng tôi phản hồi trong thời hạn pháp luật quy định.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="su-co" title="6. Khi có sự cố">
        <p>Nếu phát hiện vi phạm dữ liệu cá nhân, chúng tôi xử lý ngay, thông báo cơ quan có thẩm quyền theo thời hạn luật định, và thông báo tới người dùng bị ảnh hưởng kèm biện pháp họ nên thực hiện.</p>
      </Section>

      <Section id="truong-hoc" title="7. Cho trường học, tổ chức">
        <p>Gói Tổ chuyên môn và Doanh nghiệp có thể ký thoả thuận xử lý dữ liệu (DPA), quy định thời hạn lưu riêng, và (gói Doanh nghiệp) triển khai riêng để dữ liệu nằm trong hạ tầng do tổ chức chỉ định. <a className="underline" href="/contact">Liên hệ tư vấn</a>.</p>
      </Section>
    </LegalPage>
  );
}
