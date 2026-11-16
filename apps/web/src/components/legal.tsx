import Link from 'next/link';
import type { ReactNode } from 'react';

export const LEGAL_UPDATED = '16/11/2026';

const PAGES = [
  ['/privacy', 'Quyền riêng tư'],
  ['/data-protection', 'Bảo vệ dữ liệu'],
  ['/terms', 'Điều khoản'],
] as const;

export function LegalPage({ title, intro, current, toc, children }: {
  title: string; intro: ReactNode; current: string; toc: [string, string][]; children: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-6 text-sm lg:sticky lg:top-24 lg:self-start">
        <nav className="space-y-1" aria-label="Văn bản">
          {PAGES.map(([href, label]) => (
            <Link key={href} href={href} className={`block rounded-lg px-3 py-2 ${href === current ? 'bg-brand-50 font-semibold text-brand-700' : 'text-muted hover:bg-canvas'}`}>{label}</Link>
          ))}
        </nav>
        <nav className="hidden space-y-1 border-l border-line pl-3 lg:block" aria-label="Mục lục">
          {toc.map(([id, label]) => <a key={id} href={`#${id}`} className="block py-1 text-muted hover:text-ink">{label}</a>)}
        </nav>
      </aside>
      <article className="max-w-3xl">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Cập nhật lần cuối: {LEGAL_UPDATED}</p>
        <div className="mt-6 rounded-2xl bg-canvas p-5 text-[15px] leading-relaxed">{intro}</div>
        <div className="legal mt-10 space-y-10 text-[15px] leading-relaxed [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:border-line [&_th]:bg-canvas [&_th]:p-2 [&_th]:text-left [&_ul]:mb-3 [&_ul]:space-y-1">
          {children}
        </div>
      </article>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-24"><h2>{title}</h2>{children}</section>;
}
