'use client';

import type { ConversionDto, ExportFormat, ExportFormatInfo } from '@agg/contracts';
import { CheckCircle2, Download, FileCode2, FileText, FileType2, Gift, Lock, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useTracking } from '@/lib/tracking';
import { useToast } from '../toast';
import { Button, ButtonLink, Card, Checkbox, cx, Input } from '../ui';
import { useApiError } from '../upgrade';

const ICONS: Record<ExportFormat, typeof FileText> = { contest: Trophy, md: FileCode2, docx: FileText, doc: FileText, pdf: FileType2 };
const NOTES: Record<ExportFormat, string> = {
  contest: 'Mở trực tiếp bằng Themis: bài, test, giới hạn đã sẵn sàng.',
  md: 'Đề bài dạng Markdown, giữ nguyên công thức LaTeX.',
  docx: 'Đề bài để in hoặc chỉnh sửa trong Word.',
  doc: 'Cho Word đời cũ (2003–2007).',
  pdf: 'Đề bài in ấn, mỗi bài một trang.',
};

/** Step 3: one big download for .contest, the statements as secondary formats, then what to do next. */
export function ExportStep({ conversion, onSettings, onBack }: { conversion: ConversionDto; onSettings: (c: ConversionDto) => void; onBack: () => void }) {
  const { user } = useSession();
  const { track } = useTracking();
  const onError = useApiError();
  const toast = useToast();
  const [formats, setFormats] = useState<ExportFormatInfo[]>([]);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => { void api.formats().then(setFormats).catch(() => undefined); }, []);

  const missingTests = conversion.problems.filter((p) => p.tests.length === 0);

  const download = async (format: ExportFormat) => {
    setBusy(format);
    try {
      await api.export(conversion.id, format);
      setDone(true);
      track('export_clicked', { format });
    } catch (error) {
      onError(error);
    } finally {
      setBusy(null);
    }
  };

  const toggleStatements = async (includeStatements: boolean) => {
    try {
      onSettings(await api.updateSettings(conversion.id, { includeStatements }));
    } catch (error) {
      onError(error);
    }
  };

  const main = formats.find((f) => f.format === 'contest');
  const others = formats.filter((f) => f.format !== 'contest');

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold">Bộ đề đã sẵn sàng</h2>
        <p className="mt-2 text-muted">{conversion.problems.length} bài · {conversion.problems.reduce((n, p) => n + p.tests.length, 0)} test · {conversion.settings.ioMode === 'FILE' ? 'đọc/ghi tệp .INP/.OUT' : 'bàn phím/màn hình'}</p>
      </div>

      {missingTests.length > 0 && (
        <p className="rounded-xl bg-warn/10 p-4 text-center text-sm text-warn">
          Bài {missingTests.map((p) => p.code).join(', ')} chưa có test: Themis cần test để chấm. Bạn vẫn tải được, rồi thêm test trong Themis,
          hoặc <button className="font-medium underline" onClick={onBack}>quay lại bước Chỉnh sửa</button> để thêm tay hay dùng AI gợi ý.
        </p>
      )}

      {main && (
        <div className="flex flex-col items-center gap-3">
          <Button size="xl" onClick={() => download('contest')} loading={busy === 'contest'} className="w-full max-w-md shadow-lg shadow-brand-500/20">
            <Download className="size-6" /> Tải tệp .contest
          </Button>
          <Checkbox checked={conversion.settings.includeStatements} onChange={toggleStatements}>Kèm đề bài (DeBai.md) trong tệp .contest</Checkbox>
        </div>
      )}

      <div>
        <p className="mb-3 text-center text-sm font-medium text-muted">Hoặc tải đề bài để in, chỉnh sửa</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {others.map((f) => {
            const Icon = ICONS[f.format];
            const locked = f.requiresAccount && !user;
            return (
              <button key={f.format} onClick={() => download(f.format)} disabled={busy !== null}
                className={cx('flex items-start gap-3 rounded-2xl border border-line bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-sm disabled:opacity-60')}>
                <Icon className="size-7 shrink-0 text-brand-500" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">{f.label} {locked && <Lock className="size-3.5 text-muted" />}</span>
                  <span className="block text-sm text-muted">{locked ? 'Cần đăng nhập miễn phí' : NOTES[f.format]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {done && (user ? <SignedInNext /> : <GuestNext conversionId={conversion.id} onSaved={() => toast('ok', 'Đã lưu. Cảm ơn bạn!')} />)}
    </div>
  );
}

function SignedInNext() {
  return (
    <Card className="animate-rise p-6">
      <div className="flex items-start gap-3">
        <Gift className="size-6 shrink-0 text-brand-500" />
        <div className="space-y-3">
          <p className="font-semibold">Dùng tốt chứ? Nhận thêm credit miễn phí</p>
          <p className="text-sm text-muted">Làm khảo sát 2 phút (+20 credit), giới thiệu đồng nghiệp (+30 credit mỗi người) hoặc góp ý cho chúng tôi.</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/rewards" size="sm">Kiếm credit</ButtonLink>
            <ButtonLink href="/" variant="secondary" size="sm">Chuyển bộ đề khác</ButtonLink>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** After a guest's first success: the moment they are most willing to leave an e-mail. */
function GuestNext({ conversionId, onSaved }: { conversionId: string; onSaved: () => void }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const onError = useApiError();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.guestLead({ email, marketingConsent: consent, conversionId });
      setSaved(true);
      onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="animate-rise grid gap-6 p-6 sm:grid-cols-2">
      <div className="space-y-3">
        <p className="font-semibold">Tạo tài khoản miễn phí</p>
        <ul className="space-y-1 text-sm text-muted">
          <li className="flex gap-2"><CheckCircle2 className="size-4 text-ok" /> 30 credit dùng AI ngay</li>
          <li className="flex gap-2"><CheckCircle2 className="size-4 text-ok" /> Đọc đề từ ảnh, PDF scan</li>
          <li className="flex gap-2"><CheckCircle2 className="size-4 text-ok" /> Viết lại đề, gợi ý test</li>
          <li className="flex gap-2"><CheckCircle2 className="size-4 text-ok" /> Giữ bộ đề này 30 ngày</li>
        </ul>
        <ButtonLink href={`/login?next=/c/${conversionId}`}>Đăng ký bằng email</ButtonLink>
      </div>
      <form onSubmit={submit} className="space-y-3 border-t border-line pt-6 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
        <p className="font-semibold">Hoặc nhận mẹo dùng Themis qua email</p>
        {saved ? <p className="text-sm text-ok">Đã ghi nhận. Hẹn gặp bạn trong hộp thư!</p> : (
          <>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@truong.edu.vn" />
            <Checkbox checked={consent} onChange={setConsent}>Tôi đồng ý nhận email về tính năng mới và ưu đãi. <Link href="/privacy" className="underline">Chính sách</Link></Checkbox>
            <Button type="submit" variant="secondary" loading={busy}>Gửi</Button>
          </>
        )}
      </form>
    </Card>
  );
}
