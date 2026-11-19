import { FileDown, FileUp, ShieldCheck, Sparkles, TestTube2, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { Uploader } from '@/components/uploader';
import { ButtonLink } from '@/components/ui';
import { Retention } from '@agg/contracts';
import { MVP } from '@/lib/config';

// GD-3: the MVP has no AI, scans or statement exports, so its page promises only what it does.
const MVP_STEPS = [
  { icon: FileUp, title: 'Tải đề lên', text: 'PDF có chữ, Word hoặc dán văn bản. Một tệp có nhiều bài cũng được.' },
  { icon: Wand2, title: 'Kiểm tra từng bài', text: 'Mã bài, tên tệp vào/ra, giới hạn, đề bài và test: xem lại và sửa trước khi xuất.' },
  { icon: FileDown, title: 'Xuất .contest', text: 'Mở thẳng trong Themis để chấm, đề bài đi kèm trong bộ đề.' },
];

const MVP_FEATURES = [
  { icon: Wand2, title: 'Tách bài tự động', text: 'Nhận ra từng bài, tên tệp vào/ra, giới hạn và ví dụ trong đề.' },
  { icon: TestTube2, title: 'Test từ ví dụ', text: 'Ví dụ trong đề thành test; bạn thêm test bằng tay khi cần.' },
  { icon: Sparkles, title: 'Không dùng AI', text: 'Đề được tách bằng quy tắc, không gửi cho dịch vụ AI nào.' },
  // The retention period comes from plans.ts, the only home of limits (CLAUDE.md).
  { icon: ShieldCheck, title: 'Tệp gốc không bị lưu', text: `Đọc xong là xoá. Kết quả tự xoá sau ${Retention.guestSetHours} giờ.` },
];

const FULL_STEPS = [
  { icon: FileUp, title: 'Tải đề lên', text: 'PDF, Word, ảnh chụp hoặc dán văn bản. Một tệp có nhiều bài cũng được.' },
  { icon: Wand2, title: 'Chỉnh cấu trúc', text: 'AI tách từng bài, đặt mã bài, giới hạn, ví dụ. Bạn sửa, viết lại đề, thêm test.' },
  { icon: FileDown, title: 'Xuất .contest', text: 'Mở thẳng trong Themis để chấm. Kèm đề bài dạng Word, PDF, Markdown.' },
];

const STEPS = MVP ? MVP_STEPS : FULL_STEPS;

const FULL_FEATURES = [
  { icon: Sparkles, title: 'Đọc được cả đề scan', text: 'Ảnh chụp, PDF scan, công thức Word: AI đọc như người.' },
  { icon: Wand2, title: 'Viết lại từng mục', text: 'Đề bài, dữ liệu vào, kết quả, ràng buộc rõ ràng hơn trong một cú nhấp.' },
  { icon: TestTube2, title: 'Gợi ý test có kiểm chứng', text: 'Test biên, test đặc biệt; kết quả được tính bằng cách chạy code thật.' },
  { icon: ShieldCheck, title: 'Tệp gốc không bị lưu', text: `Đọc xong là xoá. Kết quả của khách tự xoá sau ${Retention.guestSetHours} giờ.` },
];

const FEATURES = MVP ? MVP_FEATURES : FULL_FEATURES;

export default function Home() {
  return (
    <>
      <section className="px-4 pb-16 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Chuyển đề lập trình sang Themis</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted sm:text-xl">
            Đề vào, tệp <strong className="text-ink">.contest</strong> ra.{' '}
            {MVP ? 'Tách bài, kiểm tra từng bài, rồi mở bằng Themis là chấm được ngay.' : 'AI tách bài, viết lại đề và gợi ý test — mở bằng Themis là chấm được ngay.'}
          </p>
        </div>
        <div className="mt-10">
          <Uploader />
        </div>
      </section>

      <section className="border-y border-line bg-canvas px-4 py-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-2xl bg-white p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white">{i + 1}</span>
                <step.icon className="size-5 text-brand-500" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-muted">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Bớt hàng giờ chép đề, tạo test bằng tay</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <f.icon className="size-6 text-brand-500" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!MVP && (
      <section className="px-4">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-3xl bg-ink px-6 py-12 text-center text-white sm:px-12">
          <h2 className="text-2xl font-bold sm:text-3xl">Cả tổ Tin học dùng chung một gói</h2>
          <p className="max-w-2xl text-white/75">
            Gói Tổ chuyên môn: 8.000 credit/tháng dùng chung cho 15 giáo viên, in tên trường lên đề, hoá đơn VAT, hỗ trợ qua Zalo.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/pricing" size="lg">Xem bảng giá</ButtonLink>
            <Link href="/contact" className="inline-flex h-12 items-center rounded-xl border border-white/30 px-6 font-medium hover:bg-white/10">Liên hệ tư vấn</Link>
          </div>
        </div>
      </section>
      )}
    </>
  );
}
