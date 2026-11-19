'use client';

import type { TrackEvent } from '@agg/contracts';
import { usePathname, useSearchParams } from 'next/navigation';
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { MVP } from './config';
import { getConsent, getVisitorId, saveConsent, type Consent } from './visitor';

interface Tracking {
  consent: Consent | null;
  decide: (analytics: boolean, marketing: boolean) => void;
  track: (name: string, props?: TrackEvent['props']) => void;
}

const TrackingContext = createContext<Tracking | null>(null);

const REFERRAL_KEY = 'agg.ref';

/** First-party tracking only: no third-party scripts. Page views are sent only after the visitor agreed. */
export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const queue = useRef<TrackEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setConsent(getConsent()), []);

  const flush = useCallback(() => {
    const visitorId = getVisitorId();
    const events = queue.current.splice(0);
    if (visitorId && events.length) void api.track(visitorId, events).catch(() => undefined);
  }, []);

  const track = useCallback((name: string, props?: TrackEvent['props']) => {
    if (MVP) return; // GD-3: no tracking in the MVP; the growth routes are closed.
    queue.current.push({ name, path: window.location.pathname, props });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1500);
  }, [flush]);

  const decide = useCallback((analytics: boolean, marketing: boolean) => {
    if (MVP) return;
    const value = saveConsent({ analytics, marketing });
    setConsent(value);
    const visitorId = getVisitorId();
    if (visitorId) void api.consent({ visitorId, analytics, marketing }).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ consent, decide, track }), [consent, decide, track]);
  return (
    <TrackingContext.Provider value={value}>
      {!MVP && (
        <Suspense fallback={null}>
          <PageViews consent={consent} track={track} />
        </Suspense>
      )}
      {children}
    </TrackingContext.Provider>
  );
}

function PageViews({ consent, track }: { consent: Consent | null; track: Tracking['track'] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    const visitorId = getVisitorId();
    if (!visitorId || !first.current) return;
    first.current = false;
    const ref = params.get('ref');
    if (ref) window.localStorage.setItem(REFERRAL_KEY, ref.slice(0, 16));
    void api.visit({
      visitorId,
      landingPath: pathname,
      referrer: document.referrer || undefined,
      utmSource: params.get('utm_source') ?? undefined,
      utmMedium: params.get('utm_medium') ?? undefined,
      utmCampaign: params.get('utm_campaign') ?? undefined,
      language: navigator.language,
    }).catch(() => undefined);
  }, [pathname, params]);

  useEffect(() => {
    if (consent?.analytics) track('page_view');
  }, [pathname, consent?.analytics, track]);

  return null;
}

export function useTracking(): Tracking {
  const value = useContext(TrackingContext);
  if (!value) throw new Error('useTracking outside TrackingProvider');
  return value;
}

/** The referral code of the link this visitor came from, if any. */
export function storedReferralCode(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem(REFERRAL_KEY) ?? undefined;
}
