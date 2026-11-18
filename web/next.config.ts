import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    // `web/` has its own package-lock.json, but the repository root has one
    // too, so Next would otherwise infer the root as the repository root and
    // watch every file above this app. Pin it to this directory.
    root: __dirname,
  },
  images: {
    // Modern formats plus a long minimum TTL keep unchanged logos from being
    // downloaded again on every visit.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'rxrrbznwnsgzpinirzme.supabase.co' },
    ],
  },
  experimental: {
    serverActions: {
      // Uploads are resized in the browser first, but a little headroom
      // keeps a phone photo from being rejected.
      bodySizeLimit: '4mb',
    },
  },
};

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

export default {
  ...nextConfig,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
