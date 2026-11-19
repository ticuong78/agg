'use client';

import type { ConversionDto, IoMode } from '@agg/contracts';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { MVP } from '@/lib/config';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Dialog } from '../dialog';
import { Button, Field, Input, Select } from '../ui';
import { useApiError } from '../upgrade';

export function SettingsDialog({ open, onClose, conversion, onSaved }: {
  open: boolean; onClose: () => void; conversion: ConversionDto; onSaved: (c: ConversionDto) => void;
}) {
  const { usage } = useSession();
  const onError = useApiError();
  const [name, setName] = useState(conversion.settings.name);
  const [ioMode, setIoMode] = useState<IoMode>(conversion.settings.ioMode);
  const [header, setHeader] = useState(conversion.settings.header);
  const [busy, setBusy] = useState(false);
  const branding = usage?.features.branding ?? false;

  const save = async () => {
    setBusy(true);
    try {
      onSaved(await api.updateSettings(conversion.id, { name, ioMode, ...(branding ? { header } : {}) }));
      onClose();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Thiết lập bộ đề">
      <div className="space-y-4">
        <Field label="Tên bộ đề" hint="Tên tệp xuất ra và tiêu đề trên đề in.">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Cách đọc/ghi dữ liệu">
          <Select value={ioMode} onChange={(e) => setIoMode(e.target.value as IoMode)}>
            <option value="FILE">Đọc/ghi tệp (BAI1.INP / BAI1.OUT) — phổ biến với Themis</option>
            <option value="STDIO">Bàn phím / màn hình</option>
          </Select>
        </Field>
        {/* GD-3: branding is a paid feature; the MVP has no plans, so the field is not shown at all. */}
        {!MVP && <Field label="Tiêu đề in trên đề" hint={branding ? 'Ví dụ: Trường THPT Chuyên A — Tổ Tin học' : undefined}>
          {branding
            ? <Input value={header} onChange={(e) => setHeader(e.target.value)} maxLength={200} />
            : <p className="flex items-center gap-2 rounded-lg bg-canvas p-3 text-sm text-muted"><Lock className="size-4" /> Có từ gói <Link href="/pricing" className="font-medium text-brand-600 underline">Tổ chuyên môn</Link>.</p>}
        </Field>}
        <Button onClick={save} loading={busy} className="w-full">Lưu</Button>
      </div>
    </Dialog>
  );
}
