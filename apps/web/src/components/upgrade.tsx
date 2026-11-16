'use client';

import { Lock, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useState } from 'react';
import { ApiError } from '@/lib/api';
import { Dialog } from './dialog';
import { useToast } from './toast';
import { ButtonLink } from './ui';

interface Prompt {
  action: 'signin' | 'upgrade';
  message: string;
}

/** Shows any API error; a 402 (limit or locked feature) becomes a friendly "sign in" or "upgrade" prompt. */
const UpgradeContext = createContext<(error: unknown) => void>(() => undefined);

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const toast = useToast();
  const pathname = usePathname();

  const handle = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.upgradeAction) {
      setPrompt({ action: error.upgradeAction, message: error.message });
      return;
    }
    toast('error', error instanceof Error ? error.message : 'Đã có lỗi xảy ra.');
  }, [toast]);

  const next = encodeURIComponent(pathname);
  return (
    <UpgradeContext.Provider value={handle}>
      {children}
      <Dialog open={!!prompt} onClose={() => setPrompt(null)} title={prompt?.action === 'signin' ? 'Đăng nhập để tiếp tục' : 'Cần thêm lượt dùng'}>
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
            {prompt?.action === 'signin' ? <Lock className="size-5 shrink-0" /> : <Sparkles className="size-5 shrink-0" />}
            <p>{prompt?.message}</p>
          </div>
          {prompt?.action === 'signin' ? (
            <>
              <ul className="space-y-1 text-sm text-muted">
                <li>✓ Miễn phí, chỉ cần email — không mật khẩu</li>
                <li>✓ Nhận ngay 30 credit để dùng AI</li>
                <li>✓ Bộ đề bạn đang làm được giữ nguyên</li>
              </ul>
              <ButtonLink href={`/login?next=${next}`} size="lg" className="w-full">Đăng nhập miễn phí</ButtonLink>
            </>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <ButtonLink href="/pricing" size="lg">Xem các gói</ButtonLink>
              <ButtonLink href="/rewards" variant="secondary" size="lg">Kiếm credit miễn phí</ButtonLink>
            </div>
          )}
        </div>
      </Dialog>
    </UpgradeContext.Provider>
  );
}

export const useApiError = () => useContext(UpgradeContext);
