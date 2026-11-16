import type { Metadata } from 'next';
import { LegalPage, Section } from '@/components/legal';
import { BRAND, SUPPORT_EMAIL } from '@/lib/config';

export const metadata: Metadata = { title: 'Điều khoản sử dụng' };

const TOC: [string, string][] = [
  ['dich-vu', 'Dịch vụ'], ['tai-khoan', 'Tài khoản'], ['noi-dung', 'Nội dung của bạn'], ['credit', 'Credit và thanh toán'],
  ['su-dung', 'Sử dụng hợp lệ'], ['trach-nhiem', 'Giới hạn trách nhiệm'], ['thay-doi', 'Thay đổi'],
];

export default function TermsPage() {
  return (
    <LegalPage title="Điều khoản sử dụng" current="/terms" toc={TOC}
      intro={<p>Khi dùng {BRAND}, bạn đồng ý với các điều khoản dưới đây. Chúng tôi viết ngắn và rõ nhất có thể.</p>}>
      <Section id="dich-vu" title="1. Dịch vụ">
        <p>{BRAND} chuyển tài liệu đề bài lập trình thành bộ đề có cấu trúc và tệp .contest dùng với phần mềm chấm Themis, cùng các định dạng đề bài khác. {BRAND} là sản phẩm độc lập, không liên kết với tác giả của Themis.</p>
      </Section>
      <Section id="tai-khoan" title="2. Tài khoản">
        <p>Bạn đăng nhập bằng mã gửi tới email và chịu trách nhiệm giữ an toàn hộp thư đó. Mỗi người một tài khoản; tài khoản tạo hàng loạt để lấy credit miễn phí sẽ bị khoá và thu hồi credit.</p>
      </Section>
      <Section id="noi-dung" title="3. Nội dung của bạn">
        <p>Bạn giữ toàn bộ quyền với đề bài, test và tài liệu bạn tải lên hoặc tạo ra. Bạn cho phép chúng tôi xử lý nội dung đó chỉ để cung cấp dịch vụ cho bạn. Bạn cam kết có quyền sử dụng tài liệu tải lên và tài liệu không chứa nội dung vi phạm pháp luật.</p>
        <p>Kết quả do AI tạo (đề viết lại, test gợi ý) có thể sai sót. Bạn cần kiểm tra trước khi dùng cho kỳ thi.</p>
      </Section>
      <Section id="credit" title="4. Credit và thanh toán">
        <ul>
          <li>Gói được trả trước cho 1 hoặc 12 tháng, không tự động gia hạn.</li>
          <li>Credit theo gói dùng trong 60 ngày kể từ khi cấp; credit mua thêm dùng trong 12 tháng; credit thưởng không hết hạn. Credit không quy đổi thành tiền.</li>
          <li>Thao tác AI không thành công không bị trừ credit.</li>
          <li>Nếu dịch vụ không hoạt động như mô tả trong 7 ngày đầu sau khi mua và bạn chưa dùng quá 10% credit của gói, liên hệ <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> để được hoàn tiền.</li>
        </ul>
      </Section>
      <Section id="su-dung" title="5. Sử dụng hợp lệ">
        <p>Không dùng dịch vụ để: tải lên mã độc hoặc nội dung vi phạm pháp luật; vượt giới hạn bằng cách tạo nhiều tài khoản hoặc giả mạo định danh; tự động hoá truy cập ngoài API chính thức; can thiệp vào hệ thống.</p>
      </Section>
      <Section id="trach-nhiem" title="6. Giới hạn trách nhiệm">
        <p>Dịch vụ được cung cấp theo hiện trạng. Trong phạm vi pháp luật cho phép, trách nhiệm của chúng tôi giới hạn ở số tiền bạn đã trả trong 3 tháng gần nhất. Gói Doanh nghiệp có cam kết chất lượng dịch vụ riêng theo hợp đồng.</p>
      </Section>
      <Section id="thay-doi" title="7. Thay đổi">
        <p>Khi thay đổi điều khoản quan trọng, chúng tôi thông báo qua email hoặc trên trang ít nhất 15 ngày trước khi áp dụng. Điều khoản được điều chỉnh bởi pháp luật Việt Nam.</p>
      </Section>
    </LegalPage>
  );
}
