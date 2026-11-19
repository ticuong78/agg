'use client';

import { CreditCosts, TierCatalog, type MeDto, type UsageDto } from '@agg/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { MVP } from './config';
import { forgetAccessKey, guestConversionIds, pruneAccessKeys } from './guest-keys';
import { getToken, setToken } from './token';

interface Session {
  ready: boolean;
  user: MeDto | null;
  usage: UsageDto | null;
  refreshUsage: () => Promise<void>;
  signedIn: (token: string, user: MeDto) => Promise<void>;
  signOut: () => void;
  setUser: (user: MeDto) => void;
}

const SessionContext = createContext<Session | null>(null);

/**
 * GD-3: in the MVP there are no accounts and the billing routes are closed, so the guest's limits come straight from
 * the guest plan in plans.ts. The API enforces the same plan; the daily count is not shown.
 */
const MVP_GUEST_USAGE: UsageDto = {
  tier: 'GUEST', tierName: TierCatalog.GUEST.name, credits: 0, buckets: [],
  limits: TierCatalog.GUEST.limits, features: TierCatalog.GUEST.features, costs: CreditCosts,
  guest: null, plan: null, workspace: null,
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MeDto | null>(null);
  const [usage, setUsage] = useState<UsageDto | null>(null);

  const refreshUsage = useCallback(async () => {
    setUsage(MVP ? MVP_GUEST_USAGE : await api.usage().catch(() => null));
  }, []);

  useEffect(() => {
    pruneAccessKeys();
    (async () => {
      if (MVP) {
        setUsage(MVP_GUEST_USAGE);
        setReady(true);
        return;
      }
      if (getToken()) {
        const me = await api.me().catch(() => null);
        if (!me) setToken(null);
        setUser(me);
      }
      await refreshUsage();
      setReady(true);
    })();
  }, [refreshUsage]);

  const signedIn = useCallback(async (token: string, me: MeDto) => {
    setToken(token);
    setUser(me);
    // Work done as a guest in this browser moves to the account.
    for (const id of guestConversionIds()) {
      await api.claim(id).then(() => forgetAccessKey(id)).catch(() => forgetAccessKey(id));
    }
    await refreshUsage();
  }, [refreshUsage]);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    void refreshUsage();
  }, [refreshUsage]);

  const value = useMemo(() => ({ ready, user, usage, refreshUsage, signedIn, signOut, setUser }), [ready, user, usage, refreshUsage, signedIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession outside SessionProvider');
  return session;
}
