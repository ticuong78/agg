'use client';

import { FileImage, FileText, FileType2, Lock, Plus, Type, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { rememberAccessKey } from '@/lib/guest-keys';
import { useSession } from '@/lib/session';
import { useTracking } from '@/lib/tracking';
import { Button, cx, Textarea } from './ui';
import { useApiError } from './upgrade';

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.html,.htm,.rtf,.tex,.png,.jpg,.jpeg,.webp,.gif';
const IMAGE = /\.(png|jpe?g|webp|gif)$/i;

function iconFor(name: string) {
  if (IMAGE.test(name)) return FileImage;
  if (/\.pdf$/i.test(name)) return FileType2;
  return FileText;
}

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/**
 * Step 1. One big button, the whole window accepts a drop. Selected files show as cards with one big action,
 * like single-purpose document tools: nothing else competes for attention.
 */
export function Uploader() {
  const router = useRouter();
  const { user, usage } = useSession();
  const { track } = useTracking();
  const onError = useApiError();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<'files' | 'text'>('files');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const limits = usage?.limits;
  const add = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list);
    if (!incoming.length) return;
    setMode('files');
    setFiles((current) => [...current, ...incoming].slice(0, limits?.maxFilesPerUpload ?? 30));
  }, [limits?.maxFilesPerUpload]);

  // The whole window is a drop zone.
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { depth++; setDragging(true); } };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDragging(false); };
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) add(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [add]);

  // Pasting a screenshot (Ctrl+V) adds it as an image.
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (images.length && mode === 'files') {
        add(images.map((f, i) => new File([f], f.name && f.name !== 'image.png' ? f.name : `anh-dan-${Date.now()}-${i}.png`, { type: f.type })));
      }
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [add, mode]);

  const start = async () => {
    setBusy(true);
    try {
      const result = mode === 'text' ? await api.paste(text) : await api.upload(files);
      if (result.accessKey) rememberAccessKey(result.conversion.id, result.accessKey);
      track('conversion_started', { mode, files: files.length, signedIn: !!user });
      router.push(`/c/${result.conversion.id}`);
    } catch (error) {
      onError(error);
      setBusy(false);
    }
  };

  const hasImages = files.some((f) => IMAGE.test(f.name));
  const guestLocked = !user && hasImages;
  const allowance = usage?.guest;

  return (
    <div className="mx-auto max-w-3xl">
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-brand-500/90 text-white">
          <div className="text-center">
            <Upload className="mx-auto size-16" />
            <p className="mt-4 text-2xl font-semibold">Thả tệp đề bài vào đây</p>
          </div>
        </div>
      )}

      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden"
        onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />

      {mode === 'files' && files.length === 0 && (
        <div className="flex flex-col items-center gap-3">
          <Button size="xl" onClick={() => input.current?.click()} className="w-full max-w-sm shadow-lg shadow-brand-500/20">
            Chọn tệp đề bài
          </Button>
          <p className="text-sm text-muted">hoặc thả tệp vào đây · hoặc <button className="font-medium text-brand-600 underline-offset-2 hover:underline" onClick={() => setMode('text')}>dán nội dung đề</button></p>
          <p className="text-xs text-muted">PDF, Word (.docx), văn bản (.txt, .md, .html, .rtf), ảnh chụp đề (PNG, JPG)</p>
        </div>
      )}

      {mode === 'files' && files.length > 0 && (
        <div className="animate-rise rounded-3xl bg-canvas p-4 sm:p-6">
          <ul className="grid gap-3 sm:grid-cols-2">
            {files.map((file, i) => {
              const Icon = iconFor(file.name);
              return (
                <li key={`${file.name}-${i}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
                  <Icon className="size-8 shrink-0 text-brand-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
                    <p className="text-xs text-muted">{size(file.size)}{IMAGE.test(file.name) && !user ? ' · cần đăng nhập' : ''}</p>
                  </div>
                  <button onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} aria-label={`Bỏ ${file.name}`} className="rounded-md p-1 text-muted hover:bg-canvas">
                    <X className="size-4" />
                  </button>
                </li>
              );
            })}
            {files.length < (limits?.maxFilesPerUpload ?? 1) && (
              <li>
                <button onClick={() => input.current?.click()} className="flex h-full min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-medium text-muted hover:border-brand-300 hover:text-brand-600">
                  <Plus className="size-4" /> Thêm tệp
                </button>
              </li>
            )}
          </ul>
          {guestLocked && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-white p-3 text-sm text-muted">
              <Lock className="size-4 shrink-0 text-brand-500" /> Đọc đề từ ảnh cần đăng nhập miễn phí — chỉ mất 30 giây, bạn nhận ngay 30 credit.
            </p>
          )}
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button size="xl" loading={busy} onClick={start} className="w-full max-w-sm">
              Chuyển sang Themis →
            </Button>
            <button className="text-sm text-muted hover:text-ink" onClick={() => setFiles([])}>Chọn lại</button>
          </div>
        </div>
      )}

      {mode === 'text' && (
        <div className="animate-rise rounded-3xl bg-canvas p-4 sm:p-6">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Type className="size-4 text-brand-500" /> Dán nội dung đề</div>
          <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} autoFocus
            placeholder={'Bài 1. Tổng hai số\nCho hai số nguyên a, b. Tính a + b.\nDữ liệu vào: ...\nKết quả: ...\nVí dụ: ...'}
            className="font-mono" />
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button size="xl" loading={busy} onClick={start} disabled={!text.trim()} className="w-full max-w-sm">Chuyển sang Themis →</Button>
            <button className="text-sm text-muted hover:text-ink" onClick={() => setMode('files')}>Tải tệp lên thay vì dán</button>
          </div>
        </div>
      )}

      {allowance && (
        <p className={cx('mt-4 text-center text-xs', allowance.usedToday >= allowance.dailyLimit ? 'text-danger' : 'text-muted')}>
          Hôm nay bạn đã dùng {allowance.usedToday}/{allowance.dailyLimit} lượt miễn phí
          {!user && ' · đăng nhập để có thêm lượt'}
        </p>
      )}
    </div>
  );
}
