import { NextResponse, type NextRequest } from 'next/server';
import { MVP } from '@/lib/config';

/**
 * Next 16's Proxy (formerly Middleware).
 * GD-3: pages outside the MVP answer 404 in MVP mode, as their API routes do. Terms and data protection describe
 * accounts, credit and AI, so they stay closed until rewritten; /privacy stays (GD-7 replaces its text).
 */
const CLOSED = ['/login', '/account', '/admin', '/pricing', '/rewards', '/contact', '/checkout', '/terms', '/data-protection'];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (MVP && CLOSED.some((p) => path === p || path.startsWith(`${p}/`))) {
    // A path no page answers: Next renders its not-found page with status 404.
    return NextResponse.rewrite(new URL('/__closed', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/account/:path*', '/admin/:path*', '/pricing', '/rewards', '/contact', '/checkout/:path*', '/terms', '/data-protection'],
};
