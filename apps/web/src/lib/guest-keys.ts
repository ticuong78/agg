/**
 * Guests reopen their conversion with the secret key the API gave them once. It stays in this browser only
 * (localStorage), never in a URL, so a shared link does not open someone else's work.
 */
import { Retention } from '@agg/contracts';

const KEY = 'agg.guestKeys';

type Keys = Record<string, { key: string; at: number }>;

/**
 * Every read also drops keys older than Retention.browserKeyHours (GD-7), so the privacy page's "deleted after 48 h"
 * holds whenever the site is used, not only when another set is created.
 */
function read(): Keys {
  if (typeof window === 'undefined') return {};
  let keys: Keys;
  try {
    keys = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Keys;
  } catch {
    return {};
  }
  const cutoff = Date.now() - Retention.browserKeyHours * 3_600_000;
  const stale = Object.keys(keys).filter((id) => !(keys[id]?.at >= cutoff));
  if (stale.length) {
    for (const id of stale) delete keys[id];
    window.localStorage.setItem(KEY, JSON.stringify(keys));
  }
  return keys;
}

export function accessKeyFor(conversionId: string): string | null {
  return read()[conversionId]?.key ?? null;
}

export function rememberAccessKey(conversionId: string, key: string): void {
  const keys = read();
  keys[conversionId] = { key, at: Date.now() };
  window.localStorage.setItem(KEY, JSON.stringify(keys));
}

/** Drops expired keys now (GD-7); called once per page load, so stale keys do not wait for a set page. */
export function pruneAccessKeys(): void {
  read();
}

export function guestConversionIds(): string[] {
  return Object.keys(read());
}

export function forgetAccessKey(conversionId: string): void {
  const keys = read();
  delete keys[conversionId];
  window.localStorage.setItem(KEY, JSON.stringify(keys));
}
