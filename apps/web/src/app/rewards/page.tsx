'use client';

import type { RewardActivity, RewardsDto, SurveyRequest } from '@agg/contracts';
import { Bug, CheckCircle2, ClipboardList, Copy, MessageSquareHeart, Users, Video } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/dialog';
import { useToast } from '@/components/toast';
import { Badge, Button, ButtonLink, Card, Checkbox, cx, Field, Input, PageTitle, Select, Textarea } from '@/components/ui';
import { useApiError } from '@/components/upgrade';
import { api } from '@/lib/api';
import { SITE_URL } from '@/lib/config';
import { useSession } from '@/lib/session';

const META: Record<Exclude<RewardActivity, 'REFERRED_SIGNUP'>, { icon: typeof Bug; title: string }> = {
  SURVEY: { icon: ClipboardList, title: 'Làm khảo sát 2 phút' },
  REFERRAL: { icon: Users, title: 'Giới thiệu đồng nghiệp' },
  FEEDBACK: { icon: MessageSquareHeart, title: 'Góp ý sản phẩm' },
  BUG_REPORT: { icon: Bug, title: 'Báo lỗi' },
  USER_RESEARCH: { icon: Video, title: 'Trò chuyện với nhóm sản phẩm' },
};

export default function RewardsPage() {
  const { user, ready, refreshUsage } = useSession();
  const onError = useApiError();
  const [data, setData] = useState<RewardsDto | null>(null);
  const [open, setOpen] = useState<RewardActivity | null>(null);

  const load = useCallback(() => { void api.rewards().then(setData).catch(onError); }, [onError]);
  useEffect(() => { if (user) load(); }, [user, load]);

  const done = () => { setOpen(null); load(); void refreshUsage(); };

  return (
    <div className="px-4 py-14">
      <PageTitle title="Kiếm credit miễn phí" subtitle="Giúp chúng tôi làm sản phẩm tốt hơn, nhận credit để dùng AI." />
      {ready && !user ? (
        <div className="mx-auto max-w-md text-center">
          <p className="text-muted">Đăng nhập để nhận credit thưởng. Tài khoản mới có sẵn 30 credit.</p>
          <ButtonLink href="/login?next=/rewards" size="lg" className="mt-6">Đăng nhập miễn phí</ButtonLink>
        </div>
      ) : data && (
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-center text-sm text-muted">Bạn đã nhận <strong className="text-ink">{data.creditsEarned}</strong> credit thưởng · đã giới thiệu {data.referralsTotal} người</p>
          {data.activities.map((a) => {
            const meta = META[a.activity as keyof typeof META];
            if (!meta) return null;
            return (
              <Card key={a.activity} className={cx('flex flex-wrap items-center gap-4 p-5', !a.available && 'opacity-70')}>
                <meta.icon className="size-8 shrink-0 text-brand-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{meta.title} <Badge tone="brand">+{a.activity === 'BUG_REPORT' ? `tới ${a.credits}` : a.credits} credit</Badge></p>
                  <p className="text-sm text-muted">{a.detail}</p>
                </div>
                {a.activity === 'REFERRAL'
                  ? <ReferralLink code={data.referralCode} />
                  : a.available ? <Button variant="secondary" onClick={() => setOpen(a.activity)}>Bắt đầu</Button> : <CheckCircle2 className="size-6 text-ok" />}
              </Card>
            );
          })}
        </div>
      )}
      <SurveyDialog open={open === 'SURVEY'} onClose={() => setOpen(null)} onDone={done} />
      <FeedbackDialog open={open === 'FEEDBACK'} onClose={() => setOpen(null)} onDone={done} />
      <BugDialog open={open === 'BUG_REPORT'} onClose={() => setOpen(null)} onDone={done} />
      <ResearchDialog open={open === 'USER_RESEARCH'} onClose={() => setOpen(null)} onDone={done} />
    </div>
  );
}

function ReferralLink({ code }: { code: string }) {
  const toast = useToast();
  const link = `${SITE_URL}/?ref=${code}`;
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Input readOnly value={link} className="sm:w-72" onFocus={(e) => e.target.select()} />
      <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(link); toast('ok', 'Đã sao chép đường dẫn mời.'); }} aria-label="Sao chép"><Copy className="size-4" /></Button>
    </div>
  );
}

function useSubmit<T>(send: (body: T) => Promise<{ message: string }>, onDone: () => void) {
  const toast = useToast();
  const onError = useApiError();
  const [busy, setBusy] = useState(false);
  const submit = async (body: T) => {
    setBusy(true);
    try {
      const result = await send(body);
      toast('ok', result.message);
      onDone();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };
  return { busy, submit };
}

const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button type="button" key={o} onClick={() => onChange(toggle(value, o))}
          className={cx('rounded-full border px-3 py-1 text-sm', value.includes(o) ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line text-muted')}>{o}</button>
      ))}
    </div>
  );
}

/** Also the main lead form: who they are, where they teach, what they would pay for next. */
function SurveyDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [s, setS] = useState<SurveyRequest>({
    role: 'Giáo viên', organization: '', organizationType: 'Trường THPT', province: '', subjects: ['Tin học'], studentsCount: '100–300',
    currentTools: [], painPoints: '', interestedFeatures: [], phone: '', contactConsent: false,
  });
  const { busy, submit } = useSubmit(api.survey, onDone);
  const set = (change: Partial<SurveyRequest>) => setS((x) => ({ ...x, ...change }));
  return (
    <Dialog open={open} onClose={onClose} title="Khảo sát (+20 credit)" wide>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit({ ...s, phone: s.phone || undefined }); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vai trò"><Select value={s.role} onChange={(e) => set({ role: e.target.value })}>{['Giáo viên', 'Tổ trưởng chuyên môn', 'Cán bộ quản lý', 'Giảng viên', 'Trung tâm đào tạo', 'Khác'].map((o) => <option key={o}>{o}</option>)}</Select></Field>
          <Field label="Loại đơn vị"><Select value={s.organizationType} onChange={(e) => set({ organizationType: e.target.value })}>{['Trường THCS', 'Trường THPT', 'Trường chuyên', 'Đại học / Cao đẳng', 'Trung tâm tin học', 'Phòng / Sở GD&ĐT', 'Khác'].map((o) => <option key={o}>{o}</option>)}</Select></Field>
          <Field label="Tên trường / đơn vị"><Input required value={s.organization} onChange={(e) => set({ organization: e.target.value })} maxLength={200} /></Field>
          <Field label="Tỉnh / thành phố"><Input required value={s.province} onChange={(e) => set({ province: e.target.value })} maxLength={60} /></Field>
          <Field label="Số học sinh bạn phụ trách"><Select value={s.studentsCount} onChange={(e) => set({ studentsCount: e.target.value })}>{['Dưới 100', '100–300', '300–1000', 'Trên 1000'].map((o) => <option key={o}>{o}</option>)}</Select></Field>
        </div>
        <Field label="Bạn đang dùng công cụ nào để chấm bài?"><Chips options={['Themis', 'CMS', 'DMOJ', 'Codeforces / VNOJ', 'Google Forms', 'Chấm tay']} value={s.currentTools} onChange={(v) => set({ currentTools: v })} /></Field>
        <Field label="Bạn muốn có thêm tính năng nào?"><Chips options={['Chấm bài trực tuyến', 'Ngân hàng đề', 'Sinh test lớn tự động', 'Chống gian lận', 'Thống kê lớp học', 'Đề theo chương trình GDPT 2018']} value={s.interestedFeatures} onChange={(v) => set({ interestedFeatures: v })} /></Field>
        <Field label="Việc gì tốn thời gian nhất khi ra đề, chấm bài?"><Textarea rows={3} value={s.painPoints} onChange={(e) => set({ painPoints: e.target.value })} maxLength={2000} /></Field>
        <Field label="Số điện thoại / Zalo (tuỳ chọn)"><Input value={s.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={30} /></Field>
        <Checkbox checked={s.contactConsent} onChange={(v) => set({ contactConsent: v })}>Tôi đồng ý được liên hệ về sản phẩm mới, ưu đãi cho trường học. <Link href="/privacy" className="underline">Chính sách</Link></Checkbox>
        <Button type="submit" size="lg" loading={busy} className="w-full">Gửi và nhận 20 credit</Button>
      </form>
    </Dialog>
  );
}

function FeedbackDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const { busy, submit } = useSubmit(api.feedback, onDone);
  return (
    <Dialog open={open} onClose={onClose} title="Góp ý sản phẩm (+5 credit)">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit({ rating, message }); }}>
        <Field label="Bạn hài lòng đến đâu?">
          <div className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} onClick={() => setRating(n)} className={cx('size-10 rounded-lg border text-lg', n <= rating ? 'border-brand-400 bg-brand-50' : 'border-line')} aria-label={`${n} sao`}>★</button>
          ))}</div>
        </Field>
        <Field label="Điều bạn thích, chưa thích, muốn có thêm" hint="Ít nhất 20 ký tự."><Textarea required minLength={20} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} /></Field>
        <Button type="submit" loading={busy} className="w-full">Gửi góp ý</Button>
      </form>
    </Dialog>
  );
}

function BugDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [b, setB] = useState({ title: '', steps: '', expected: '', actual: '' });
  const { busy, submit } = useSubmit(api.bugReport, onDone);
  return (
    <Dialog open={open} onClose={onClose} title="Báo lỗi (+10–50 credit khi xác nhận)" wide>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit({ ...b, pageUrl: window.location.href }); }}>
        <Field label="Lỗi gì?"><Input required minLength={5} value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} maxLength={200} /></Field>
        <Field label="Các bước để gặp lỗi"><Textarea required rows={3} value={b.steps} onChange={(e) => setB({ ...b, steps: e.target.value })} maxLength={3000} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bạn mong đợi điều gì"><Textarea required rows={2} value={b.expected} onChange={(e) => setB({ ...b, expected: e.target.value })} maxLength={2000} /></Field>
          <Field label="Thực tế xảy ra"><Textarea required rows={2} value={b.actual} onChange={(e) => setB({ ...b, actual: e.target.value })} maxLength={2000} /></Field>
        </div>
        <Button type="submit" loading={busy} className="w-full">Gửi báo lỗi</Button>
      </form>
    </Dialog>
  );
}

function ResearchDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [availability, setAvailability] = useState('');
  const [phone, setPhone] = useState('');
  const { busy, submit } = useSubmit(api.research, onDone);
  return (
    <Dialog open={open} onClose={onClose} title="Trò chuyện 30 phút (+50 credit)">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit({ availability, phone: phone || undefined }); }}>
        <p className="text-sm text-muted">Nhóm sản phẩm muốn nghe cách bạn ra đề và chấm bài. Gọi video 30 phút; credit được cộng sau buổi trò chuyện.</p>
        <Field label="Khung giờ bạn rảnh"><Input required minLength={3} value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="Tối thứ 3, thứ 5 sau 20h" maxLength={300} /></Field>
        <Field label="Số điện thoại / Zalo (tuỳ chọn)"><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} /></Field>
        <Button type="submit" loading={busy} className="w-full">Đăng ký</Button>
      </form>
    </Dialog>
  );
}
