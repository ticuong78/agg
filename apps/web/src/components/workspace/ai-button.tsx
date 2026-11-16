'use client';

import { Lock, Sparkles } from 'lucide-react';
import { useSession } from '@/lib/session';
import { Button } from '../ui';

/** An AI action with its cost. Guests see the lock (the API answers 402 and the sign-in prompt opens). */
export function AiButton({ label, cost, onClick, loading, size = 'sm' }: {
  label: string; cost: number; onClick: () => void; loading?: boolean; size?: 'sm' | 'md';
}) {
  const { user } = useSession();
  return (
    <Button variant="secondary" size={size} onClick={onClick} loading={loading} title={user ? `${cost} credit` : 'Cần đăng nhập'}>
      {!loading && (user ? <Sparkles className="size-4 text-brand-500" /> : <Lock className="size-4 text-muted" />)}
      {label}
      <span className="rounded-full bg-canvas px-1.5 text-xs text-muted">{cost}</span>
    </Button>
  );
}
