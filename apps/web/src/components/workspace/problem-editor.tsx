'use client';

import type { ConversionDto, ProblemDto, UpdateProblemRequest } from '@agg/contracts';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, cx, Field, Input } from '../ui';
import { useApiError } from '../upgrade';
import { SectionEditor } from './section-editor';
import { TestsEditor } from './tests-editor';

const TABS = [
  { id: 'statement', label: 'Đề bài' },
  { id: 'tests', label: 'Test' },
  { id: 'limits', label: 'Mã bài & giới hạn' },
] as const;

export function ProblemEditor({ conversion, problem, onProblem, onConversion }: {
  conversion: ConversionDto;
  problem: ProblemDto;
  onProblem: (p: ProblemDto) => void;
  onConversion: (c: ConversionDto) => void;
}) {
  const onError = useApiError();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('statement');
  const [limits, setLimits] = useState({ code: problem.code, timeLimitMs: problem.timeLimitMs, memoryLimitMb: problem.memoryLimitMb });
  const [savingLimits, setSavingLimits] = useState(false);

  const patch = async (body: UpdateProblemRequest) => {
    onProblem(await api.updateProblem(conversion.id, problem.id, body));
  };

  const saveLimits = async () => {
    setSavingLimits(true);
    try {
      await patch(limits);
    } catch (error) {
      onError(error);
    } finally {
      setSavingLimits(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Xoá bài ${problem.code} khỏi bộ đề?`)) return;
    try {
      onConversion(await api.removeProblem(conversion.id, problem.id));
    } catch (error) {
      onError(error);
    }
  };

  const sectionProps = { conversionId: conversion.id, problemId: problem.id };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-semibold text-brand-600">{problem.code}</p>
          <h2 className="truncate text-xl font-bold">{problem.title}</h2>
        </div>
        {conversion.problems.length > 1 && (
          <Button variant="ghost" size="sm" onClick={remove} aria-label="Xoá bài"><Trash2 className="size-4" /></Button>
        )}
      </div>

      {problem.warnings.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-warn/10 p-3 text-sm text-warn">
          {problem.warnings.map((w) => <li key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}</li>)}
        </ul>
      )}

      <div role="tablist" className="flex gap-1 rounded-xl bg-canvas p-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cx('flex-1 rounded-lg px-3 py-2 text-sm font-medium', tab === t.id ? 'bg-white shadow-sm' : 'text-muted hover:text-ink')}>
            {t.label}{t.id === 'tests' ? ` (${problem.tests.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'statement' && (
        <div className="space-y-3">
          <SectionEditor {...sectionProps} section="title" label="Tên bài" value={problem.title} multiline={false} onSave={(title) => patch({ title })} />
          <SectionEditor {...sectionProps} section="statement" label="Đề bài" value={problem.statement} onSave={(statement) => patch({ statement })} />
          <SectionEditor {...sectionProps} section="inputFormat" label="Dữ liệu vào" value={problem.inputFormat} onSave={(inputFormat) => patch({ inputFormat })} />
          <SectionEditor {...sectionProps} section="outputFormat" label="Kết quả" value={problem.outputFormat} onSave={(outputFormat) => patch({ outputFormat })} />
          <SectionEditor {...sectionProps} section="constraints" label="Ràng buộc" value={problem.constraints} onSave={(constraints) => patch({ constraints })} />
        </div>
      )}

      {tab === 'tests' && (
        <TestsEditor key={problem.id + problem.tests.length} conversionId={conversion.id} problem={problem} onChange={onProblem} ioMode={conversion.settings.ioMode} />
      )}

      {tab === 'limits' && (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-4">
          <Field label="Mã bài (tên bài trong Themis)" hint="Đặt tên thư mục bài và tệp test: BAI1 → BAI1.INP, BAI1.OUT. Học sinh nộp BAI1.CPP / BAI1.PAS / BAI1.PY.">
            <Input value={limits.code} maxLength={16} onChange={(e) => setLimits((l) => ({ ...l, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))} className="font-mono" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Giới hạn thời gian (giây/test)">
              <Input type="number" min={0.1} max={20} step={0.1} value={limits.timeLimitMs / 1000}
                onChange={(e) => setLimits((l) => ({ ...l, timeLimitMs: Math.round(Number(e.target.value) * 1000) }))} />
            </Field>
            <Field label="Giới hạn bộ nhớ (MB)">
              <Input type="number" min={16} max={2048} value={limits.memoryLimitMb} onChange={(e) => setLimits((l) => ({ ...l, memoryLimitMb: Number(e.target.value) }))} />
            </Field>
          </div>
          <Button loading={savingLimits} onClick={saveLimits}>Lưu</Button>
        </div>
      )}
    </div>
  );
}
