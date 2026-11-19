'use client';

import type { ConversionDto, ProblemDto } from '@agg/contracts';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowRight, FileWarning, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, ButtonLink, cx, Spinner } from '@/components/ui';
import { useApiError } from '@/components/upgrade';
import { ExportStep } from '@/components/workspace/export-step';
import { ProblemEditor } from '@/components/workspace/problem-editor';
import { SettingsDialog } from '@/components/workspace/settings-dialog';
import { Stepper } from '@/components/workspace/stepper';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { MVP } from '@/lib/config';

const PROCESSING_TIPS = [
  'Đang đọc tài liệu…',
  'Đang tách từng bài…',
  'Đang nhận diện dữ liệu vào, kết quả, ví dụ…',
  'Đang đặt mã bài và giới hạn…',
];

export default function ConversionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { refreshUsage } = useSession();
  const onError = useApiError();
  const [conversion, setConversion] = useState<ConversionDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tip, setTip] = useState(0);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const c = await api.conversion(id);
      setConversion(c);
      if (c.status === 'PROCESSING') poll.current = setTimeout(load, 1500);
      else {
        setSelected((s) => s ?? c.problems[0]?.id ?? null);
        void refreshUsage();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setNotFound(true);
      else onError(error);
    }
  }, [id, onError, refreshUsage]);

  useEffect(() => {
    void load();
    return () => { if (poll.current) clearTimeout(poll.current); };
  }, [load]);

  useEffect(() => {
    if (conversion?.status !== 'PROCESSING') return;
    const t = setInterval(() => setTip((i) => (i + 1) % PROCESSING_TIPS.length), 2500);
    return () => clearInterval(t);
  }, [conversion?.status]);

  const updateProblem = (p: ProblemDto) =>
    setConversion((c) => (c ? { ...c, problems: c.problems.map((x) => (x.id === p.id ? p : x)) } : c));

  const updateConversion = (c: ConversionDto) => {
    setConversion(c);
    if (!c.problems.some((p) => p.id === selected)) setSelected(c.problems[0]?.id ?? null);
  };

  const move = async (index: number, delta: -1 | 1) => {
    if (!conversion) return;
    const ids = conversion.problems.map((p) => p.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      setConversion(await api.reorder(conversion.id, ids));
    } catch (error) {
      onError(error);
    }
  };

  if (notFound) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <FileWarning className="mx-auto size-12 text-muted" />
        <h1 className="mt-4 text-2xl font-bold">Không tìm thấy bộ đề</h1>
        <p className="mt-2 text-muted">Bộ đề đã hết hạn lưu, đã bị xoá, hoặc được mở từ trình duyệt khác.{MVP ? '' : ' Đăng nhập để giữ bộ đề lâu hơn.'}</p>
        <ButtonLink href="/" className="mt-6">Chuyển bộ đề mới</ButtonLink>
      </div>
    );
  }

  if (!conversion || conversion.status === 'PROCESSING') {
    return (
      <div className="px-4 py-12">
        <Stepper current={1} />
        <div className="mx-auto mt-20 max-w-md text-center">
          <Spinner className="mx-auto size-12" />
          <p className="mt-6 text-xl font-semibold">{PROCESSING_TIPS[tip]}</p>
          <p className="mt-2 text-sm text-muted">Thường mất 10–60 giây tuỳ độ dài đề. Bạn có thể để tab này chạy nền.</p>
        </div>
      </div>
    );
  }

  if (conversion.status === 'FAILED') {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <AlertTriangle className="mx-auto size-12 text-warn" />
        <h1 className="mt-4 text-2xl font-bold">Chưa xử lý được tài liệu</h1>
        <p className="mt-2 text-muted">{conversion.failure}</p>
        <Button className="mt-6" onClick={() => router.push('/')}>Thử lại với tệp khác</Button>
      </div>
    );
  }

  const problem = conversion.problems.find((p) => p.id === selected) ?? conversion.problems[0];

  return (
    <div className="px-4 pb-28 pt-8">
      <Stepper current={step} onSelect={setStep} />

      {step === 2 ? (
        <div className="mt-10"><ExportStep conversion={conversion} onSettings={setConversion} onBack={() => setStep(1)} /></div>
      ) : (
        <div className="mx-auto mt-8 grid max-w-6xl gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold" title={conversion.settings.name}>{conversion.settings.name}</p>
                <p className="text-xs text-muted">{conversion.problems.length} bài · đọc bằng {conversion.engine === 'AI' ? 'AI' : 'bộ đọc cơ bản'}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} aria-label="Thiết lập bộ đề"><Settings2 className="size-4" /></Button>
            </div>
            <ol className="space-y-1">
              {conversion.problems.map((p, i) => (
                <li key={p.id} className="group flex items-center gap-1">
                  <button onClick={() => setSelected(p.id)}
                    className={cx('flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left', p.id === problem?.id ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-canvas')}>
                    <span className="font-mono text-xs font-semibold text-brand-600">{p.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                    {p.tests.length === 0 ? <Badge tone="warn">0 test</Badge> : p.warnings.length > 0 && <AlertTriangle className="size-3.5 text-warn" />}
                  </button>
                  <span className="flex flex-col opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <button onClick={() => move(i, -1)} aria-label="Lên" className="rounded p-0.5 text-muted hover:text-ink"><ArrowUp className="size-3" /></button>
                    <button onClick={() => move(i, 1)} aria-label="Xuống" className="rounded p-0.5 text-muted hover:text-ink"><ArrowDown className="size-3" /></button>
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted">Lưu đến {new Date(conversion.expiresAt).toLocaleString('vi-VN')}. <Link href="/privacy#luu-tru" className="underline">Vì sao?</Link></p>
          </aside>

          <section>
            {problem && <ProblemEditor key={problem.id} conversion={conversion} problem={problem} onProblem={updateProblem} onConversion={updateConversion} />}
          </section>
        </div>
      )}

      {step === 1 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <p className="hidden text-sm text-muted sm:block">Kiểm tra từng bài, rồi xuất tệp cho Themis.</p>
            <Button size="lg" onClick={() => { setStep(2); window.scrollTo({ top: 0 }); }} className="ml-auto">
              Tiếp: Xuất file <ArrowRight className="size-5" />
            </Button>
          </div>
        </div>
      )}

      <SettingsDialog key={String(settingsOpen)} open={settingsOpen} onClose={() => setSettingsOpen(false)} conversion={conversion} onSaved={setConversion} />
    </div>
  );
}
