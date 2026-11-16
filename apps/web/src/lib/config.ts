export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const BRAND = process.env.NEXT_PUBLIC_BRAND ?? 'GóiĐề';
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'hotro@example.com';
export const SUPPORT_ZALO = process.env.NEXT_PUBLIC_SUPPORT_ZALO ?? '';
