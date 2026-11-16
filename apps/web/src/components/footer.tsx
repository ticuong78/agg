import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { BRAND, SUPPORT_EMAIL } from '@/lib/config';
import { Logo } from './header';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-canvas">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted">Đề lập trình vào, Themis ra. Không cài đặt, không cấu hình.</p>
        </div>
        <FooterColumn title="Sản phẩm" links={[['/', 'Chuyển đổi đề'], ['/pricing', 'Bảng giá'], ['/rewards', 'Kiếm credit'], ['/contact', 'Liên hệ cho trường học']]} />
        <FooterColumn title="Tin cậy" links={[['/privacy', 'Chính sách quyền riêng tư'], ['/data-protection', 'Bảo vệ dữ liệu'], ['/terms', 'Điều khoản sử dụng']]} />
        <div className="space-y-3 text-sm">
          <p className="font-semibold">Hỗ trợ</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="block text-muted hover:text-ink">{SUPPORT_EMAIL}</a>
          <p className="flex items-start gap-2 text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
            Tệp gốc của bạn không bao giờ được lưu lại sau khi xử lý.
          </p>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">© {new Date().getFullYear()} {BRAND}. Themis là phần mềm chấm bài của tác giả Lê Minh Hoàng và Đỗ Đức Đông; {BRAND} không liên kết với nhóm tác giả.</div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold">{title}</p>
      {links.map(([href, label]) => <Link key={href} href={href} className="block text-muted hover:text-ink">{label}</Link>)}
    </div>
  );
}
