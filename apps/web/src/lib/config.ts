import { parseAppMode, type AppMode } from '@agg/contracts';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const BRAND = process.env.NEXT_PUBLIC_BRAND ?? 'GóiĐề';
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'hotro@example.com';
export const SUPPORT_ZALO = process.env.NEXT_PUBLIC_SUPPORT_ZALO ?? '';

/**
 * GD-3: `mvp` unless NEXT_PUBLIC_APP_MODE is exactly `full` (set it together with the API's APP_MODE). In the MVP the
 * web offers only the guest path and never calls the closed API routes; the API enforces the same rule on its own.
 */
export const APP_MODE: AppMode = parseAppMode(process.env.NEXT_PUBLIC_APP_MODE) === 'full' ? 'full' : 'mvp';
export const MVP = APP_MODE === 'mvp';
