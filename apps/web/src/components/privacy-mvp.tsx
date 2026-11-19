import { Retention, TierCatalog } from '@agg/contracts';
import { LegalPage, Section } from '@/components/legal';
import { BRAND, SUPPORT_EMAIL } from '@/lib/config';

/**
 * GD-7: the privacy page of the MVP. Short, and true to the code: every period comes from Retention in plans.ts,
 * which the cleanup jobs, the web and a test against deploy/ also read. A new kind of data about users is added here,
 * with its period, in the same change that collects it (CLAUDE.md data rule 4).
 */
const UPDATED = '19/11/2026';
const months = Math.round((Retention.analyticsDays / 365) * 12);

const TOC: [string, string][] = [
  ['tom-tat', 'Tóm tắt'], ['luu-tru', 'Dữ liệu và thời gian lưu'], ['ai', 'Không dùng AI'], ['chia-se', 'Ai nhận dữ liệu'],
  ['trinh-duyet', 'Bộ nhớ trình duyệt'], ['quyen', 'Quyền của bạn'], ['tre-em', 'Học sinh'], ['lien-he', 'Liên hệ'],
];

export function MvpPrivacy() {
  return (
    <LegalPage
      title="Chính sách quyền riêng tư"
      current="/privacy"
      toc={TOC}
      updated={UPDATED}
      intro={<p>
        Bản thử nghiệm của {BRAND} chỉ làm một việc: chuyển đề lập trình bạn đưa vào thành tệp <strong>.contest</strong> cho Themis.
        Không cần tài khoản, <strong>không dùng AI</strong>, và <strong>tệp gốc không bao giờ được lưu</strong>.
      </p>}
    >
      <Section id="tom-tat" title="1. Tóm tắt">
        <ul>
          <li>Không cần tài khoản: chúng tôi không biết tên hay email của bạn.</li>
          <li>Tệp bạn tải lên chỉ nằm trong bộ nhớ máy chủ trong lúc đọc, không được ghi xuống đĩa hay cơ sở dữ liệu.</li>
          <li>Bộ đề (nội dung đề, test, tên tệp) tự xoá sau {Retention.guestSetHours} giờ. Bạn có thể xoá ngay bằng nút &ldquo;Xoá bộ đề&rdquo;.</li>
          <li>Không có cookie, quảng cáo hay công cụ thống kê của bên thứ ba.</li>
        </ul>
      </Section>

      <Section id="luu-tru" title="2. Dữ liệu và thời gian lưu">
        <table>
          <thead><tr><th>Dữ liệu</th><th>Dùng để</th><th>Thời gian lưu</th></tr></thead>
          <tbody>
            <tr><td>Tệp bạn tải lên hoặc nội dung bạn dán</td><td>Đọc và tách đề</td><td>Chỉ trong lúc xử lý; không lưu</td></tr>
            <tr><td>Bộ đề: nội dung đề, test, tên tệp, thiết lập, kèm mã ngẫu nhiên của trình duyệt và mã băm của khoá mở</td><td>Để bạn xem lại, sửa và xuất</td><td>{Retention.guestSetHours} giờ (sau đó không mở được nữa và bị xoá trong vòng một giờ), hoặc đến khi bạn bấm &ldquo;Xoá bộ đề&rdquo;</td></tr>
            <tr><td>Mã ngẫu nhiên của trình duyệt và địa chỉ IP đã mã hoá một chiều</td><td>Tính {TierCatalog.GUEST.limits.dailyConversions} lượt miễn phí mỗi ngày, chống lạm dụng</td><td>{Retention.usageCounterDays} ngày</td></tr>
            <tr><td>Địa chỉ IP đã mã hoá một chiều, trong bộ nhớ máy chủ</td><td>Giới hạn số lần gửi đề mỗi giờ</td><td>Không ghi xuống đĩa; mất khi máy chủ khởi động lại</td></tr>
            <tr><td>Thống kê ẩn danh: số bài trong bộ đề, định dạng đã xuất, không kèm mã nào để nhận ra bạn</td><td>Biết sản phẩm có được dùng hay không</td><td>{months} tháng</td></tr>
            <tr><td>Nhật ký máy chủ: không ghi địa chỉ IP, mã trình duyệt hay khoá mở; thông báo lỗi khi đọc tệp có thể kèm một đoạn ngắn của tệp</td><td>Tìm và sửa lỗi</td><td>Ghi đè khi đầy: {Retention.logFiles} tệp × {Retention.logFileMb} MB cho mỗi dịch vụ</td></tr>
            <tr><td>Bản sao lưu cơ sở dữ liệu hằng đêm (không chứa bộ đề và bộ đếm lượt ở trên)</td><td>Khôi phục khi có sự cố</td><td>{Retention.backupDays} ngày</td></tr>
          </tbody>
        </table>
        <p>Địa chỉ IP không bao giờ được lưu ở dạng gốc. Dạng đã mã hoá không thể đảo ngược trực tiếp, nhưng vẫn gắn với địa chỉ của bạn, nên chúng tôi coi đó là dữ liệu cá nhân và xoá sau {Retention.usageCounterDays} ngày.</p>
      </Section>

      <Section id="ai" title="3. Không dùng AI">
        <p>Đề được tách bằng các quy tắc chạy trên máy chủ của chúng tôi. Nội dung đề không được gửi cho dịch vụ AI nào và không được dùng để huấn luyện mô hình.</p>
      </Section>

      <Section id="chia-se" title="4. Ai nhận dữ liệu">
        <ul>
          <li><strong>Nhà cung cấp máy chủ</strong> nơi chạy API và cơ sở dữ liệu: lưu bộ đề và các dữ liệu ở mục 2 thay cho chúng tôi.</li>
          <li><strong>Vercel</strong> phục vụ các trang web. Đề bài đi thẳng từ trình duyệt tới máy chủ của chúng tôi, không qua Vercel. Vercel có nhật ký truy cập riêng (địa chỉ IP, loại trình duyệt) theo chính sách của họ.</li>
        </ul>
        <p>Phông chữ được phục vụ từ chính trang này. Chúng tôi không bán dữ liệu và không chia sẻ cho quảng cáo.</p>
      </Section>

      <Section id="trinh-duyet" title="5. Bộ nhớ trình duyệt">
        <p>Không dùng cookie. Trang lưu hai mục trong bộ nhớ của trình duyệt (localStorage):</p>
        <ul>
          <li><strong>Mã ngẫu nhiên</strong> do trình duyệt tạo, gửi kèm mỗi yêu cầu tới máy chủ để tính lượt miễn phí. Mã ở lại đến khi bạn xoá dữ liệu trang web.</li>
          <li><strong>Khoá mở bộ đề</strong>, để chỉ trình duyệt này mở được bộ đề của bạn. Khoá tự xoá sau {Retention.browserKeyHours} giờ, hoặc ngay khi bạn xoá bộ đề.</li>
        </ul>
      </Section>

      <Section id="quyen" title="6. Quyền của bạn">
        <ul>
          <li>Xoá bộ đề ngay: nút &ldquo;Xoá bộ đề&rdquo; trên trang chỉnh sửa.</li>
          <li>Quên mã ngẫu nhiên: xoá dữ liệu của trang này trong cài đặt trình duyệt.</li>
          <li>Hỏi hoặc yêu cầu về dữ liệu: email bên dưới. Vì không có tài khoản, chúng tôi chỉ nhận ra một bộ đề qua đường dẫn và khoá trong trình duyệt của bạn.</li>
        </ul>
      </Section>

      <Section id="tre-em" title="7. Học sinh">
        <p>{BRAND} dành cho giáo viên và người ra đề. Đề bài không nên chứa tên hay thông tin của học sinh; nếu có, hãy xoá trước khi tải lên.</p>
      </Section>

      <Section id="lien-he" title="8. Liên hệ">
        <p><a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      </Section>
    </LegalPage>
  );
}
