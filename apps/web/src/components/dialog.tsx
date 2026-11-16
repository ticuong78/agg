'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Native <dialog>: focus trapping, Escape and the backdrop come from the browser. */
export function Dialog({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] rounded-2xl p-0 shadow-2xl backdrop:bg-ink/40 ${wide ? 'max-w-2xl' : 'max-w-md'}`}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Đóng" className="rounded-md p-1 text-muted hover:bg-canvas">
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
