'use client';

import { CreditCosts, type TextSection } from '@agg/contracts';
import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Markdown } from '../markdown';
import { Button, Input, Textarea } from '../ui';
import { useApiError } from '../upgrade';
import { AiButton } from './ai-button';

/**
 * One section of a statement: read view (rendered Markdown), edit view, and the AI rewrite as a proposal the
 * teacher keeps or discards. Nothing changes without the teacher's click.
 */
export function SectionEditor({ conversionId, problemId, section, label, value, onSave, multiline = true }: {
  conversionId: string; problemId: string; section: TextSection; label: string; value: string;
  onSave: (value: string) => Promise<void>; multiline?: boolean;
}) {
  const { refreshUsage } = useSession();
  const onError = useApiError();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [proposal, setProposal] = useState<{ text: string; notes: string[] } | null>(null);
  const [instruction, setInstruction] = useState('');

  const save = async (text: string) => {
    setSaving(true);
    try {
      await onSave(text);
      setEditing(false);
      setProposal(null);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  const rewrite = async () => {
    setRewriting(true);
    try {
      const result = await api.rewrite(conversionId, problemId, { section, instruction: instruction.trim() || undefined });
      setProposal({ text: result.text, notes: result.notes });
      void refreshUsage();
    } catch (error) {
      onError(error);
    } finally {
      setRewriting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{label}</h3>
        <div className="ml-auto flex flex-wrap gap-2">
          {!editing && <Button variant="ghost" size="sm" onClick={() => { setDraft(value); setEditing(true); }}><Pencil className="size-4" /> Sửa</Button>}
          <AiButton label="Viết lại" cost={CreditCosts.REWRITE_SECTION} onClick={rewrite} loading={rewriting} />
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          {multiline
            ? <Textarea rows={Math.min(16, Math.max(4, draft.split('\n').length + 1))} value={draft} onChange={(e) => setDraft(e.target.value)} className="font-mono text-[13px]" />
            : <Input value={draft} onChange={(e) => setDraft(e.target.value)} />}
          <p className="text-xs text-muted">Hỗ trợ Markdown và công thức LaTeX, ví dụ $1 \le n \le 10^5$.</p>
          <div className="flex gap-2">
            <Button size="sm" loading={saving} onClick={() => save(draft)}><Check className="size-4" /> Lưu</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Huỷ</Button>
          </div>
        </div>
      ) : value.trim() ? (
        multiline ? <Markdown>{value}</Markdown> : <p>{value}</p>
      ) : (
        <p className="text-sm italic text-muted">(Trống — bấm Sửa hoặc để AI viết)</p>
      )}

      {proposal && (
        <div className="animate-rise mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <p className="mb-2 text-sm font-semibold text-brand-700">Đề xuất của AI</p>
          {multiline ? <Markdown>{proposal.text}</Markdown> : <p>{proposal.text}</p>}
          {proposal.notes.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-warn">{proposal.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" loading={saving} onClick={() => save(proposal.text)}><Check className="size-4" /> Dùng bản này</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(proposal.text); setEditing(true); setProposal(null); }}>Sửa thêm</Button>
            <Button size="sm" variant="ghost" onClick={() => setProposal(null)}><X className="size-4" /> Bỏ</Button>
          </div>
          <form className="mt-3 flex gap-2 border-t border-brand-100 pt-3" onSubmit={(e) => { e.preventDefault(); void rewrite(); }}>
            <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={500}
              placeholder="Viết lại theo ý khác: ngắn gọn hơn, thêm câu chuyện, cho học sinh lớp 8…" />
            <Button type="submit" size="sm" variant="secondary" loading={rewriting} disabled={!instruction.trim()}>Viết lại</Button>
          </form>
        </div>
      )}
    </section>
  );
}
