import type { NextConfig } from 'next';

// The Supabase project host is configuration, not a constant of this repository:
// preview deployments and a future project move must not need a code change.
function supabaseHostname(): string | null {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}

const projectHostname = supabaseHostname();

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
      ...(projectHostname
        ? [{ protocol: 'https' as const, hostname: projectHostname }]
        : []),
    ],
  },
  experimental: {
    serverActions: {
      // Images are resized in the browser first, but the admin agreement form
      // accepts PDFs up to 5 MB, so the request limit must leave room for that
      // plus multipart overhead or the upload is rejected before it lands here.
      bodySizeLimit: '8mb',
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
