'use client';

import {
  CreditActionLabels, CreditCosts, CreditActions, formatVnd, TierCatalog, TopUpPacks, type BillingPeriod, type CheckoutProduct, type Tier,
} from '@agg/contracts';
import { Check, Minus, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckoutDialog } from '@/components/checkout-dialog';
import { Badge, Button, ButtonLink, Card, cx, PageTitle } from '@/components/ui';
import { useSession } from '@/lib/session';

const SHOWN: Tier[] = ['FREE', 'INDIVIDUAL', 'SCHOOL', 'ENTERPRISE'];

const COMPARE: [string, (t: Tier) => string | boolean][] = [
  ['Credit mỗi tháng', (t) => (t === 'ENTERPRISE' ? 'Theo nhu cầu' : TierCatalog[t].monthlyCredits.toLocaleString('vi-VN'))],
  ['Chuyển đổi tài liệu văn bản', (t) => (TierCatalog[t].limits.dailyConversions ? `${TierCatalog[t].limits.dailyConversions} lượt/ngày` : 'Không giới hạn')],
  ['Tệp mỗi lần tải lên', (t) => String(TierCatalog[t].limits.maxFilesPerUpload)],
  ['Dung lượng mỗi tệp', (t) => `${TierCatalog[t].limits.maxFileMb} MB`],
  ['Số bài mỗi bộ đề', (t) => String(TierCatalog[t].limits.maxProblems)],
  ['Đọc đề từ ảnh, PDF scan', (t) => TierCatalog[t].features.images],
  ['AI viết lại đề, gợi ý test', (t) => TierCatalog[t].features.rewrite],
  ['Xuất Word, PDF', (t) => TierCatalog[t].features.documentExports],
  ['Xử lý ưu tiên', (t) => TierCatalog[t].features.priorityQueue],
  ['Thành viên dùng chung', (t) => (TierCatalog[t].features.sharedPool ? (t === 'ENTERPRISE' ? 'Không giới hạn' : `${TierCatalog[t].seats}+`) : false)],
  ['In tên trường lên đề', (t) => TierCatalog[t].features.branding],
  ['Hoá đơn VAT', (t) => t === 'SCHOOL' || t === 'ENTERPRISE'],
  ['API tích hợp, SSO', (t) => TierCatalog[t].features.apiAccess],
  ['Lưu lịch sử', (t) => { const d = TierCatalog[t].limits.retentionDays; return d >= 365 ? `${Math.round(d / 365)} năm` : `${d} ngày`; }],
];

const FAQ = [
  ['Không đăng nhập có dùng được không?', 'Được. Khách có 3 lượt/ngày chuyển PDF, Word hoặc văn bản sang .contest. Đăng nhập miễn phí để đọc ảnh, dùng AI viết lại đề và gợi ý test.'],
  ['Credit là gì?', 'Đơn vị dùng chung cho các tính năng AI tốn chi phí: đọc ảnh/trang scan (1 credit/trang), viết lại một mục (1 credit), gợi ý một lượt test có chạy kiểm chứng (3 credit). Chuyển đổi tài liệu văn bản và xuất file luôn miễn phí.'],
  ['Credit có hết hạn không?', 'Credit theo gói dùng được 2 tháng (cộng dồn 1 tháng). Credit mua thêm dùng trong 12 tháng. Credit thưởng và quà chào mừng không hết hạn.'],
  ['Gói có tự động gia hạn không?', 'Không. Bạn trả trước cho 1 hoặc 12 tháng; mua tiếp trước khi hết hạn thì thời gian được cộng dồn.'],
  ['Trường tôi cần hoá đơn đỏ và hợp đồng?', 'Gói Tổ chuyên môn và Doanh nghiệp có hoá đơn VAT, thanh toán chuyển khoản, hợp đồng và thoả thuận xử lý dữ liệu. Liên hệ để được báo giá.'],
  ['Tài liệu của tôi có an toàn không?', 'Tệp gốc không bao giờ được lưu sau khi đọc. Kết quả chỉ bạn mở được, và tự xoá theo thời hạn lưu của gói. Xem trang Bảo vệ dữ liệu.'],
];

export default function PricingPage() {
  const router = useRouter();
  const { user, usage } = useSession();
  const [period, setPeriod] = useState<BillingPeriod>('YEAR');
  const [extraSeats, setExtraSeats] = useState(0);
  const [product, setProduct] = useState<CheckoutProduct | null>(null);

  const buy = (p: CheckoutProduct) => {
    if (!user) router.push('/login?next=/pricing');
    else setProduct(p);
  };

  return (
    <div className="px-4 py-14">
      <PageTitle title="Chọn gói phù hợp" subtitle="Bắt đầu miễn phí. Trả theo mức dùng, nâng cấp khi cần thêm." />

      <div className="mb-10 flex justify-center">
        <div className="inline-flex rounded-full bg-canvas p-1" role="radiogroup" aria-label="Chu kỳ thanh toán">
          {(['MONTH', 'YEAR'] as const).map((p) => (
            <button key={p} role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
              className={cx('rounded-full px-5 py-2 text-sm font-medium', period === p ? 'bg-white shadow-sm' : 'text-muted')}>
              {p === 'MONTH' ? 'Theo tháng' : 'Theo năm'}
              {p === 'YEAR' && <Badge tone="brand" className="ml-2">Tặng 2 tháng</Badge>}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SHOWN.map((tier) => {
          const t = TierCatalog[tier];
          const current = usage?.tier === tier;
          const price = period === 'YEAR' ? t.priceYearly : t.priceMonthly;
          return (
            <Card key={tier} className={cx('relative flex flex-col p-6', t.highlighted && 'border-2 border-brand-500 shadow-xl shadow-brand-500/10')}>
              {t.highlighted && <Badge tone="brand" className="absolute -top-3 left-6 bg-brand-500 text-white">Phổ biến nhất</Badge>}
              <h2 className="text-lg font-bold">{t.name}</h2>
              <p className="mt-1 min-h-10 text-sm text-muted">{t.tagline}</p>
              <div className="mt-4 min-h-16">
                {price === null ? <p className="text-2xl font-bold">Liên hệ</p> : price === 0 ? <p className="text-3xl font-bold">0đ</p> : (
                  <>
                    <p className="text-3xl font-bold">{formatVnd(period === 'YEAR' ? Math.round(price / 12) : price)}<span className="text-base font-normal text-muted">/tháng</span></p>
                    {period === 'YEAR' && <p className="text-xs text-muted">Thanh toán {formatVnd(price)} mỗi năm</p>}
                  </>
                )}
              </div>
              {tier === 'SCHOOL' && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
                  <span>Thêm thành viên</span>
                  <span className="flex items-center gap-2">
                    <button onClick={() => setExtraSeats((n) => Math.max(0, n - 5))} className="rounded border border-line px-2" aria-label="Bớt 5">−</button>
                    <span className="w-8 text-center font-medium">{extraSeats}</span>
                    <button onClick={() => setExtraSeats((n) => Math.min(200, n + 5))} className="rounded border border-line px-2" aria-label="Thêm 5">+</button>
                  </span>
                </div>
              )}
              <div className="mt-4">
                {tier === 'FREE' ? (
                  user ? <Button variant="secondary" className="w-full" disabled>{current ? 'Gói hiện tại' : 'Đã bao gồm'}</Button>
                    : <ButtonLink href="/login" variant="secondary" className="w-full">Đăng ký miễn phí</ButtonLink>
                ) : tier === 'ENTERPRISE' ? (
                  <ButtonLink href="/contact?interest=ENTERPRISE" variant="secondary" className="w-full">Liên hệ tư vấn</ButtonLink>
                ) : (
                  <Button variant={t.highlighted ? 'primary' : 'secondary'} className="w-full"
                    onClick={() => buy({ kind: 'PLAN', tier: tier as 'INDIVIDUAL' | 'SCHOOL', period, extraSeats: tier === 'SCHOOL' ? extraSeats : undefined })}>
                    {current ? 'Gia hạn' : `Chọn ${t.name}`}
                  </Button>
                )}
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {t.perks.map((perk) => <li key={perk} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ok" /> {perk}</li>)}
              </ul>
            </Card>
          );
        })}
      </div>

      <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-muted">
        Chưa muốn đăng ký? Khách vẫn chuyển được 3 tệp PDF/Word/văn bản mỗi ngày sang .contest, không cần tài khoản.
      </p>

      <section className="mx-auto mt-20 max-w-4xl">
        <h2 className="text-center text-2xl font-bold">Mua thêm credit</h2>
        <p className="mt-2 text-center text-muted">Dùng cho mọi gói, hạn dùng 12 tháng. Mua càng nhiều càng rẻ.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {TopUpPacks.map((pack, i) => (
            <Card key={pack.id} className="flex flex-col items-center p-6 text-center">
              <p className="text-2xl font-bold">{pack.credits.toLocaleString('vi-VN')} credit</p>
              <p className="mt-1 text-muted">{formatVnd(pack.price)}</p>
              <p className="mt-1 text-xs text-muted">{Math.round(pack.price / pack.credits).toLocaleString('vi-VN')}đ/credit{i > 0 ? ` · tiết kiệm ${Math.round((1 - pack.price / pack.credits / (TopUpPacks[0].price / TopUpPacks[0].credits)) * 100)}%` : ''}</p>
              <Button variant="secondary" className="mt-4 w-full" onClick={() => buy({ kind: 'TOPUP', packId: pack.id })}>Mua</Button>
            </Card>
          ))}
        </div>
        <div className="mt-8 rounded-2xl bg-canvas p-6">
          <p className="font-semibold">Mỗi thao tác tốn bao nhiêu?</p>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <li className="flex justify-between gap-4"><span>Chuyển PDF/Word/văn bản → .contest</span><strong>Miễn phí</strong></li>
            {CreditActions.map((a) => <li key={a} className="flex justify-between gap-4"><span>{CreditActionLabels[a]}</span><strong>{CreditCosts[a]} credit</strong></li>)}
            <li className="flex justify-between gap-4"><span>Xuất .contest, Word, PDF, Markdown</span><strong>Miễn phí</strong></li>
          </ul>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl overflow-x-auto">
        <h2 className="mb-6 text-center text-2xl font-bold">So sánh chi tiết</h2>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="py-3 text-left font-medium text-muted">Tính năng</th>
              {SHOWN.map((t) => <th key={t} className="py-3 text-center font-semibold">{TierCatalog[t].name}</th>)}
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(([label, value]) => (
              <tr key={label} className="border-b border-line">
                <td className="py-3">{label}</td>
                {SHOWN.map((t) => {
                  const v = value(t);
                  return <td key={t} className="py-3 text-center">{v === true ? <Check className="mx-auto size-4 text-ok" /> : v === false ? <Minus className="mx-auto size-4 text-line" /> : v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mx-auto mt-20 flex max-w-4xl items-start gap-4 rounded-3xl border border-line p-8">
        <ShieldCheck className="size-10 shrink-0 text-ok" />
        <div>
          <h2 className="text-xl font-bold">Dữ liệu của bạn được bảo vệ</h2>
          <p className="mt-2 text-muted">Tệp gốc bị xoá ngay sau khi đọc. Kết nối mã hoá HTTPS. Nội dung đề chỉ được gửi tới nhà cung cấp AI để xử lý, không dùng để huấn luyện mô hình. Thực hiện theo pháp luật Việt Nam về bảo vệ dữ liệu cá nhân.</p>
          <ButtonLink href="/data-protection" variant="secondary" size="sm" className="mt-4">Cách chúng tôi bảo vệ dữ liệu</ButtonLink>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="mb-6 text-center text-2xl font-bold">Câu hỏi thường gặp</h2>
        <div className="divide-y divide-line rounded-2xl border border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group p-5">
              <summary className="cursor-pointer list-none font-medium marker:hidden">{q}</summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <CheckoutDialog product={product} onClose={() => setProduct(null)} />
    </div>
  );
}
