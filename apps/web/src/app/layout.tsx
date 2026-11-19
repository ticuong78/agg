import type { Metadata } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import { ConsentBanner } from '@/components/consent-banner';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { ToastProvider } from '@/components/toast';
import { UpgradeProvider } from '@/components/upgrade';
import { BRAND, MVP, SITE_URL } from '@/lib/config';
import { SessionProvider } from '@/lib/session';
import { TrackingProvider } from '@/lib/tracking';

const ui = Be_Vietnam_Pro({ subsets: ['latin', 'latin-ext', 'vietnamese'], weight: ['400', '500', '600', '700'], variable: '--font-ui', display: 'swap' });
const code = JetBrains_Mono({ subsets: ['latin', 'latin-ext', 'vietnamese'], variable: '--font-code', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND} — Chuyển đề lập trình sang Themis (.contest)`, template: `%s | ${BRAND}` },
  description: MVP
    ? 'Tải lên đề bài lập trình (PDF có chữ, Word, văn bản), kiểm tra từng bài và xuất tệp .contest dùng ngay trong Themis. Không dùng AI.'
    : 'Tải lên đề bài lập trình (PDF, Word, ảnh, văn bản), AI tách bài, viết lại đề, gợi ý test và xuất tệp .contest dùng ngay trong Themis.',
  openGraph: { title: `${BRAND} — Đề lập trình vào, Themis ra`, locale: 'vi_VN', type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${ui.variable} ${code.variable}`}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <ToastProvider>
          <SessionProvider>
            <TrackingProvider>
              <UpgradeProvider>
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
                <ConsentBanner />
              </UpgradeProvider>
            </TrackingProvider>
          </SessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
