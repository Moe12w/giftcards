import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://giftly.qa').replace(
  /\/$/,
  '',
);

type SitemapEntry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: SitemapEntry[] = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/ai-gift-cards`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/vendors`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/corporate`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/download`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...(['client', 'vendor', 'enterprise', 'bulk'] as const).flatMap((audience) => [
      {
        url: `${SITE_URL}/legal/${audience}/terms`,
        lastModified: now,
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      },
      {
        url: `${SITE_URL}/legal/${audience}/privacy`,
        lastModified: now,
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      },
    ]),
  ];

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

    const vendorRoutes: SitemapEntry[] = (data ?? [])
      .map((row) => (row as { slug?: string | null }).slug)
      .filter((slug): slug is string => Boolean(slug))
      .map((slug) => ({
        url: `${SITE_URL}/vendors/${slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));

    return [...staticRoutes, ...vendorRoutes];
  } catch {
    // A sitemap must never take the site down. Fall back to the stable pages.
    return staticRoutes;
  }
}
