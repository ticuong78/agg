/**
 * The anonymous visitor id (a random UUID kept in localStorage). It is strictly necessary: the free daily allowance
 * of guests is counted with it. Analytics and marketing use need the visitor's consent (see consent.tsx).
 */
const ID_KEY = 'agg.visitor';
const CONSENT_KEY = 'agg.consent';

export interface Consent {
  analytics: boolean;
  marketing: boolean;
  at: number;
}

export function getVisitorId(): string | null {
  if (typeof window === 'undefined') return null;
  let id = window.localStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

export function saveConsent(consent: Omit<Consent, 'at'>): Consent {
  const value = { ...consent, at: Date.now() };
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
  return value;
}
