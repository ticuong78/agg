'use client';

import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState } from 'react';

interface Toast {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

const ToastContext = createContext<(kind: Toast['kind'], text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="animate-rise pointer-events-auto flex max-w-lg items-start gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
            {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-300" /> : <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-300" />}
            <span>{t.text}</span>
            <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Đóng" className="ml-2 opacity-60 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
