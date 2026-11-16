'use client';

import { CreditCosts, type ProblemDto, type SuggestTestsResponse, type TestCaseDto } from '@agg/contracts';
import { BadgeCheck, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Dialog } from '../dialog';
import { Badge, Button, Checkbox, Field, Input, Select, Textarea } from '../ui';
import { useApiError } from '../upgrade';
import { AiButton } from './ai-button';

type EditableTest = Omit<TestCaseDto, 'id'> & { id?: string };

/** Tests of one problem: what Themis will judge with. Edits are saved with one click for the whole list. */
export function TestsEditor({ conversionId, problem, onChange, ioMode }: {
  conversionId: string; problem: ProblemDto; onChange: (p: ProblemDto) => void; ioMode: 'FILE' | 'STDIO';
}) {
  const { refreshUsage } = useSession();
  const onError = useApiError();
  const [tests, setTests] = useState<EditableTest[]>(problem.tests);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [count, setCount] = useState(5);
  const [focus, setFocus] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [result, setResult] = useState<SuggestTestsResponse | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);

  const [inName, outName] = ioMode === 'FILE' ? [`${problem.code}.INP`, `${problem.code}.OUT`] : ['Input', 'Output'];

  const update = (i: number, change: Partial<EditableTest>) => {
    setTests((t) => t.map((x, j) => (j === i ? { ...x, ...change } : x)));
    setDirty(true);
  };

  const persist = async (list: EditableTest[]) => {
    setSaving(true);
    try {
      const saved = await api.updateProblem(conversionId, problem.id, {
        tests: list.map(({ id, input, output, isSample, score }) => ({ id, input, output, isSample, score })),
      });
      onChange(saved);
      setTests(saved.tests);
      setDirty(false);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  const suggest = async () => {
    setSuggesting(true);
    setResult(null);
    try {
      const r = await api.suggestTests(conversionId, problem.id, { count, focus: focus.trim() || undefined });
      setResult(r);
      setPicked(r.suggestions.map(() => true));
      void refreshUsage();
    } catch (error) {
      setSuggestOpen(false);
      onError(error);
    } finally {
      setSuggesting(false);
    }
  };

  const addPicked = async () => {
    if (!result) return;
    const extra = result.suggestions.filter((_, i) => picked[i]).map((s) => ({ input: s.input, output: s.output, isSample: false, score: 1 }));
    setSuggestOpen(false);
    setResult(null);
    await persist([...tests, ...extra]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">{tests.length} test · mỗi test là một thư mục TestXX chứa {inName} và {outName}</p>
        <div className="ml-auto flex gap-2">
          <AiButton label="Gợi ý test" cost={CreditCosts.SUGGEST_TESTS} onClick={() => setSuggestOpen(true)} />
          <Button variant="secondary" size="sm" onClick={() => { setTests((t) => [...t, { input: '', output: '', isSample: false, score: 1 }]); setDirty(true); }}>
            <Plus className="size-4" /> Thêm test
          </Button>
        </div>
      </div>

      {tests.length === 0 && <p className="rounded-xl bg-warn/10 p-4 text-sm text-warn">Chưa có test. Themis cần ít nhất một test để chấm: thêm tay hoặc dùng “Gợi ý test”.</p>}

      <ol className="space-y-3">
        {tests.map((t, i) => (
          <li key={t.id ?? `new-${i}`} className="rounded-2xl border border-line bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">Test{String(i + 1).padStart(2, '0')}</span>
              {t.isSample && <Badge tone="brand">Ví dụ trong đề</Badge>}
              {t.verified && <Badge tone="ok"><BadgeCheck className="size-3" /> Đã chạy kiểm chứng</Badge>}
              <label className="ml-auto flex items-center gap-1 text-xs text-muted">
                Điểm <Input type="number" min={0} max={100} step={0.25} value={t.score} onChange={(e) => update(i, { score: Number(e.target.value) })} className="h-8 w-20" />
              </label>
              <button onClick={() => { setTests((x) => x.filter((_, j) => j !== i)); setDirty(true); }} aria-label={`Xoá test ${i + 1}`} className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-danger">
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={inName}><Textarea rows={3} value={t.input} onChange={(e) => update(i, { input: e.target.value })} className="font-mono text-[13px]" spellCheck={false} /></Field>
              <Field label={outName}><Textarea rows={3} value={t.output} onChange={(e) => update(i, { output: e.target.value })} className="font-mono text-[13px]" spellCheck={false} /></Field>
            </div>
          </li>
        ))}
      </ol>

      {dirty && (
        <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
          <span>Bạn có thay đổi chưa lưu trong danh sách test.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => { setTests(problem.tests); setDirty(false); }}>Hoàn tác</Button>
            <Button size="sm" loading={saving} onClick={() => persist(tests)}>Lưu test</Button>
          </div>
        </div>
      )}

      <Dialog open={suggestOpen} onClose={() => !suggesting && setSuggestOpen(false)} title={`Gợi ý test cho ${problem.code}`} wide>
        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">AI đọc đề, viết lời giải, chạy code để tính kết quả cho từng test mới. Thường mất 30–90 giây.</p>
            <Field label="Số test">
              <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} test</option>)}
              </Select>
            </Field>
            <Field label="Mong muốn thêm (tuỳ chọn)" hint="Ví dụ: tập trung vào trường hợp n = 1 và mảng toàn số âm. Phần trái với đề sẽ được bỏ qua và giải thích.">
              <Textarea rows={2} value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={1000} />
            </Field>
            <Button loading={suggesting} onClick={suggest} className="w-full" size="lg">
              {suggesting ? 'AI đang chạy thử lời giải…' : `Gợi ý (${CreditCosts.SUGGEST_TESTS} credit)`}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {result.focusRejections.length > 0 && (
              <ul className="list-disc space-y-1 rounded-xl bg-warn/10 p-3 pl-7 text-sm text-warn">{result.focusRejections.map((r) => <li key={r}>{r}</li>)}</ul>
            )}
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
              {result.suggestions.map((s, i) => (
                <li key={i} className="rounded-xl border border-line p-3">
                  <Checkbox checked={picked[i] ?? false} onChange={(v) => setPicked((p) => p.map((x, j) => (j === i ? v : x)))}>
                    <span className="font-medium">{s.purpose}</span>{' '}
                    {s.verified ? <Badge tone="ok">Đã chạy kiểm chứng</Badge> : <Badge tone="warn">Nên kiểm tra lại</Badge>}
                  </Checkbox>
                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                    <pre className="max-h-32 overflow-auto rounded-lg bg-canvas p-2 font-mono">{s.input}</pre>
                    <pre className="max-h-32 overflow-auto rounded-lg bg-canvas p-2 font-mono">{s.output}</pre>
                  </div>
                </li>
              ))}
            </ul>
            {result.notes.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-muted">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            <Button onClick={addPicked} className="w-full" size="lg" disabled={!picked.some(Boolean)}>
              Thêm {picked.filter(Boolean).length} test đã chọn
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
