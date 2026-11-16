import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared contracts package lives in the monorepo (packages/contracts).
  transpilePackages: ['@agg/contracts'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  turbopack: { root: path.join(__dirname, '../..') },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'img.vietqr.io' }] },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default nextConfig;
