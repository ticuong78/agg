/**
 * Guests reopen their conversion with the secret key the API gave them once. It stays in this browser only
 * (localStorage), never in a URL, so a shared link does not open someone else's work.
 */
const KEY = 'agg.guestKeys';

type Keys = Record<string, { key: string; at: number }>;

function read(): Keys {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Keys;
  } catch {
    return {};
  }
}

export function accessKeyFor(conversionId: string): string | null {
  return read()[conversionId]?.key ?? null;
}

export function rememberAccessKey(conversionId: string, key: string): void {
  const keys = read();
  keys[conversionId] = { key, at: Date.now() };
  // Guest results live 24 hours; older keys are useless.
  const dayAgo = Date.now() - 48 * 3_600_000;
  for (const [id, v] of Object.entries(keys)) if (v.at < dayAgo) delete keys[id];
  window.localStorage.setItem(KEY, JSON.stringify(keys));
}

export function guestConversionIds(): string[] {
  return Object.keys(read());
}

export function forgetAccessKey(conversionId: string): void {
  const keys = read();
  delete keys[conversionId];
  window.localStorage.setItem(KEY, JSON.stringify(keys));
}
