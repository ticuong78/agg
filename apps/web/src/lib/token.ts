const KEY = 'agg.token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEY);
}

export function setToken(token: string | null): void {
  if (token) window.localStorage.setItem(KEY, token);
  else window.localStorage.removeItem(KEY);
}
