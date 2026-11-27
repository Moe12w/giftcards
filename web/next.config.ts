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

/**
 * The public site is prerendered under /en and /ar. These rewrites keep the
 * original neutral URLs (/faq, /vendors, …) working and pick the locale from
 * the cookie, so no request-time code runs for an anonymous visitor.
 *
 * Dashboards, auth callbacks and /api are deliberately absent: they must keep
 * hitting their dynamic routes untouched.
 */
const LOCALE_COOKIE = 'tazella.locale';
const publicRewritePaths = [
  '',
  'faq',
  'contact',
  'corporate',
  'download',
  'vendors',
  'vendors/:slug',
  'legal',
  'legal/:audience/:doc',
  'privacy',
  'terms',
  'ai-gift-cards',
  'plug-in-integrations',
  'account-deletion',
];

function publicLocaleRewrites() {
  const rules: {
    source: string;
    destination: string;
    has?: { type: 'cookie'; key: string; value: string }[];
    missing?: { type: 'cookie'; key: string; value: string }[];
  }[] = [];
  for (const path of publicRewritePaths) {
    const source = path === '' ? '/' : `/${path}`;
    const suffix = path === '' ? '' : `/${path}`;
    rules.push({
      source,
      destination: `/ar${suffix}`,
      has: [{ type: 'cookie', key: LOCALE_COOKIE, value: 'ar' }],
    });
    rules.push({
      source,
      destination: `/en${suffix}`,
      missing: [{ type: 'cookie', key: LOCALE_COOKIE, value: 'ar' }],
    });
  }
  return rules;
}

const nextConfig: NextConfig = {
  turbopack: {
    // `web/` has its own package-lock.json, but the repository root has one
    // too, so Next would otherwise infer the root as the repository root and
    // watch every file above this app. Pin it to this directory.
    root: __dirname,
  },
  images: {
    // Modern formats plus a 7-day minimum TTL keep unchanged logos from being
    // re-optimized every day. Each unique (image, size, format) counts against
    // the 5k/month Hobby transformation budget; a 1-day TTL burned it in weeks.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
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
  async rewrites() {
    // afterFiles keeps real dashboard/API routes ahead of these fallbacks.
    return { afterFiles: publicLocaleRewrites() };
  },
};

/**
 * Content Security Policy.
 *
 * `script-src` has to allow inline script because Next renders its hydration
 * bootstrap as inline <script> tags. Removing `'unsafe-inline'` means minting a
 * per-request nonce in `proxy.ts`, which forces every matched route to render
 * dynamically — a hosting decision for the marketing pages, not a header edit.
 * `script-src-attr 'none'` still blocks inline event handlers, which React
 * never needs, so injected `onclick=` payloads do not run.
 */
function contentSecurityPolicy(): string {
  const connectSources = ["'self'"];
  if (projectHostname) {
    // Supabase REST/auth/storage over HTTPS and its realtime socket.
    connectSources.push(`https://${projectHostname}`, `wss://${projectHostname}`);
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "script-src-attr 'none'",
    // Figtree is imported from Google Fonts in app/globals.css.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Vendor logos and ad creatives are stored or entered as arbitrary URLs and
    // fall back to a plain <img> when Next's optimizer does not cover the host.
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSources.join(' ')}`,
    // The scanner and document viewers spawn blob workers when needed.
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ');
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
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
      // Neutral URLs are rewritten to /en or /ar based on a cookie. Vary makes
      // shared caches keep a separate copy for each locale.
      {
        source: '/',
        headers: [{ key: 'Vary', value: 'Cookie' }],
      },
      ...publicRewritePaths
        .filter((path) => path !== '')
        .map((path) => ({
          source: `/${path}`,
          headers: [{ key: 'Vary', value: 'Cookie' }],
        })),
    ];
  },
};
