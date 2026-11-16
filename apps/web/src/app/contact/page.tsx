'use client';

import type { ContactSalesRequest, PaidTier } from '@agg/contracts';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Card, Checkbox, Field, Input, PageTitle, Select, Textarea } from '@/components/ui';
import { useApiError } from '@/components/upgrade';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

function ContactForm() {
  const params = useSearchParams();
  const { user } = useSession();
  const onError = useApiError();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState<ContactSalesRequest>({
    name: user?.name ?? '', email: user?.email ?? '', phone: '', organization: '', organizationType: 'Trường THPT',
    seats: undefined, message: '', interest: (params.get('interest') as PaidTier) ?? 'SCHOOL', marketingConsent: false,
  });
  const set = (change: Partial<ContactSalesRequest>) => setForm((f) => ({ ...f, ...change }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.contactSales({ ...form, phone: form.phone || undefined, message: form.message || undefined });
      setSent(true);
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok" />
        <h2 className="mt-4 text-2xl font-bold">Đã nhận yêu cầu</h2>
        <p className="mt-2 text-muted">Chúng tôi sẽ liên hệ trong 1 ngày làm việc để tư vấn gói và báo giá.</p>
      </div>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl p-6 sm:p-8">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ tên"><Input required minLength={2} value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} /></Field>
          <Field label="Email công việc"><Input required type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="Số điện thoại / Zalo"><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={30} /></Field>
          <Field label="Quan tâm gói">
            <Select value={form.interest} onChange={(e) => set({ interest: e.target.value as PaidTier })}>
              <option value="SCHOOL">Tổ chuyên môn / trường học</option>
              <option value="ENTERPRISE">Doanh nghiệp / Sở, Phòng GD&ĐT</option>
              <option value="INDIVIDUAL">Giáo viên</option>
            </Select>
          </Field>
          <Field label="Tên đơn vị"><Input required minLength={2} value={form.organization} onChange={(e) => set({ organization: e.target.value })} maxLength={200} /></Field>
          <Field label="Loại đơn vị">
            <Select value={form.organizationType} onChange={(e) => set({ organizationType: e.target.value })}>
              {['Trường THCS', 'Trường THPT', 'Trường chuyên', 'Đại học / Cao đẳng', 'Trung tâm tin học', 'Phòng / Sở GD&ĐT', 'Doanh nghiệp đào tạo', 'Khác'].map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Số giáo viên dự kiến"><Input type="number" min={1} value={form.seats ?? ''} onChange={(e) => set({ seats: e.target.value ? Number(e.target.value) : undefined })} /></Field>
        </div>
        <Field label="Nhu cầu của bạn (tuỳ chọn)"><Textarea rows={4} value={form.message} onChange={(e) => set({ message: e.target.value })} maxLength={2000} placeholder="Số kỳ thi mỗi năm, nhu cầu hoá đơn, tích hợp hệ thống..." /></Field>
        <Checkbox checked={form.marketingConsent} onChange={(v) => set({ marketingConsent: v })}>Tôi đồng ý nhận thông tin sản phẩm và ưu đãi. <Link href="/privacy" className="underline">Chính sách</Link></Checkbox>
        <p className="text-xs text-muted">Thông tin chỉ dùng để tư vấn cho yêu cầu này.</p>
        <Button type="submit" size="lg" loading={busy} className="w-full">Gửi yêu cầu tư vấn</Button>
      </form>
    </Card>
  );
}

export default function ContactPage() {
  return (
    <div className="px-4 py-14">
      <PageTitle title="Tư vấn cho trường học và tổ chức" subtitle="Hoá đơn VAT, hợp đồng, thoả thuận xử lý dữ liệu, giá theo số giáo viên." />
      <Suspense><ContactForm /></Suspense>
    </div>
  );
}
