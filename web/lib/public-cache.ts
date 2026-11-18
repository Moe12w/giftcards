import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { mapProducts } from './data';
import type { Product } from './types';
import { getPublicClient } from './supabase/public';

/**
 * Tags shared by every public catalogue cache. Writes that change a business,
 * product or category call `revalidateTag(CACHE_TAGS.marketplace, 'max')` so
 * the next visit picks up fresh data while the current one stays fast.
 */
export const CACHE_TAGS = {
  marketplace: 'marketplace',
  businesses: 'marketplace-businesses',
  catalog: 'marketplace-catalog',
} as const;

const TAGS = [CACHE_TAGS.marketplace, CACHE_TAGS.businesses, CACHE_TAGS.catalog];
const FIVE_MINUTES = 300;

export interface PublicBusiness {
  id: string;
  business_kind: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  city: string | null;
  area: string | null;
  rating: number | null;
  description: string | null;
  gift_count: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

/** The business directory with the banner used on listing cards. */
export interface PublicBusinessRow extends PublicBusiness {
  banner_url: string | null;
}

export interface MarketplaceSnapshot {
  businesses: PublicBusiness[];
  offers: Product[];
  categories: PublicCategory[];
  businessTotal: number;
  productTotal: number;
}

/** Everything the marketing homepage needs, fetched once and reused. */
async function loadMarketplaceSnapshot(): Promise<MarketplaceSnapshot> {
  const startedAt = process.env.NODE_ENV === 'development' ? Date.now() : 0;
  const supabase = getPublicClient();
  const [businessCount, productCount, categoryResult, featuredResult, offersResult] =
    await Promise.all([
      supabase.from('marketplace_businesses').select('id', { count: 'exact', head: true }),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .eq('is_active', true),
      supabase.from('categories').select('id, name, slug').eq('active', true),
      supabase
        .from('marketplace_businesses')
        .select('id, business_kind, name, slug, logo_url, city, area, rating, description, gift_count')
        .order('business_kind', { ascending: true })
        .order('gift_count', { ascending: false })
        .order('rating', { ascending: false })
        .limit(6),
      supabase
        .from('products')
        .select(
          '*, vendors(id, name, slug, logo_url, status), partner:enterprise_partners(id, name, slug, logo_url), product_variants(*)',
        )
        .eq('status', 'published')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(6),
    ]);

  if (startedAt) {
    console.debug('[perf] marketplace snapshot fetched in', Date.now() - startedAt, 'ms');
  }
  return {
    businesses: (featuredResult.data ?? []) as PublicBusiness[],
    offers: mapProducts(offersResult.data),
    categories: (categoryResult.data ?? []) as PublicCategory[],
    businessTotal: businessCount.count ?? 0,
    productTotal: productCount.count ?? 0,
  };
}

/** Cached across requests; React `cache` also dedupes layout + page reads. */
export const getMarketplaceSnapshot = cache(
  unstable_cache(loadMarketplaceSnapshot, ['marketplace-snapshot-v1'], {
    tags: TAGS,
    revalidate: FIVE_MINUTES,
  }),
);

/** The whole public business directory, cached for the listing and search. */
export const getCachedBusinessDirectory = cache(
  unstable_cache(
    async (): Promise<PublicBusinessRow[]> => {
      const supabase = getPublicClient();
      const { data } = await supabase
        .from('marketplace_businesses')
        .select('id, business_kind, name, slug, logo_url, banner_url, city, area, rating, description, gift_count')
        .order('gift_count', { ascending: false })
        .order('rating', { ascending: false });
      return (data ?? []) as PublicBusinessRow[];
    },
    ['public-business-directory-v1'],
    { tags: TAGS, revalidate: FIVE_MINUTES },
  ),
);

/** One business by id or slug, shared by metadata and page in the same request. */
export const getCachedBusiness = cache(
  unstable_cache(
    async (slug: string) => {
      const supabase = getPublicClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      let query = supabase.from('marketplace_businesses').select('*');
      query = isUuid ? query.eq('id', slug) : query.eq('slug', slug);
      const { data } = await query.maybeSingle();
      return data ?? null;
    },
    ['public-business-v1'],
    { tags: TAGS, revalidate: FIVE_MINUTES },
  ),
);

/** Published products and locations for a business detail page. */
export const getCachedBusinessCatalog = cache(
  unstable_cache(
    async (businessId: string, isPartner: boolean) => {
      const supabase = getPublicClient();
      const [productsResult, locationsResult] = await Promise.all([
        supabase
          .from('products')
          .select('*, product_variants(*)')
          .eq(isPartner ? 'partner_id' : 'vendor_id', businessId)
          .eq('status', 'published')
          .eq('is_active', true)
          .order('rating', { ascending: false }),
        isPartner
          ? Promise.resolve({ data: null })
          : supabase
              .from('vendor_locations')
              .select('*')
              .eq('vendor_id', businessId)
              .order('is_primary', { ascending: false }),
      ]);
      return {
        products: mapProducts(productsResult.data),
        locations: locationsResult.data ?? [],
      };
    },
    ['public-business-catalog-v1'],
    { tags: TAGS, revalidate: FIVE_MINUTES },
  ),
);
