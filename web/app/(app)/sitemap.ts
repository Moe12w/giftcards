import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://giftly.qa').replace(
  /\/$/,
  '',
);

const LOCALES = ['en', 'ar'] as const;
type SitemapEntry = MetadataRoute.Sitemap[number];
type EntryMeta = Omit<SitemapEntry, 'url'>;

/** Public pages are prerendered per locale; each canonical includes the prefix. */
function forLocales(path: string, meta: EntryMeta): SitemapEntry[] {
  return LOCALES.map((locale) => ({
    ...meta,
    url: `${SITE_URL}/${locale}${path}`,
    alternates: {
      languages: {
        en: `${SITE_URL}/en${path}`,
        ar: `${SITE_URL}/ar${path}`,
      },
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPaths: { path: string; meta: EntryMeta }[] = [
    { path: '', meta: { lastModified: now, changeFrequency: 'weekly', priority: 1 } },
    { path: '/ai-gift-cards', meta: { lastModified: now, changeFrequency: 'weekly', priority: 0.9 } },
    { path: '/vendors', meta: { lastModified: now, changeFrequency: 'daily', priority: 0.9 } },
    { path: '/corporate', meta: { lastModified: now, changeFrequency: 'monthly', priority: 0.8 } },
    { path: '/download', meta: { lastModified: now, changeFrequency: 'monthly', priority: 0.7 } },
    { path: '/faq', meta: { lastModified: now, changeFrequency: 'monthly', priority: 0.6 } },
    { path: '/contact', meta: { lastModified: now, changeFrequency: 'yearly', priority: 0.6 } },
    { path: '/terms', meta: { lastModified: now, changeFrequency: 'yearly', priority: 0.3 } },
    { path: '/privacy', meta: { lastModified: now, changeFrequency: 'yearly', priority: 0.3 } },
    { path: '/legal', meta: { lastModified: now, changeFrequency: 'yearly', priority: 0.3 } },
    { path: '/account-deletion', meta: { lastModified: now, changeFrequency: 'yearly', priority: 0.3 } },
  ];
  for (const audience of ['client', 'vendor', 'enterprise', 'bulk'] as const) {
    for (const doc of ['terms', 'privacy'] as const) {
      staticPaths.push({
        path: `/legal/${audience}/${doc}`,
        meta: { lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
      });
    }
  }
  const staticRoutes = staticPaths.flatMap(({ path, meta }) => forLocales(path, meta));

  // Public business pages are the long tail of the marketplace. The anon key
  // only exposes approved, published rows through RLS, so this stays safe.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return staticRoutes;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase
      .from('marketplace_businesses')
      .select('slug,gift_count')
      .eq('business_kind', 'vendor')
      .gt('gift_count', 0)
      .not('slug', 'is', null)
      .limit(1000);

    const slugs = (data ?? [])
      .map((row) => (row as { slug?: string | null }).slug)
      .filter((slug): slug is string => Boolean(slug));
    const vendorRoutes = slugs.flatMap((slug) =>
      forLocales(`/vendors/${slug}`, {
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      }),
    );

    return [...staticRoutes, ...vendorRoutes];
  } catch {
    // A sitemap must never take the site down. Fall back to the stable pages.
    return staticRoutes;
  }
}
