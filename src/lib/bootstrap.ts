// src/lib/bootstrap.ts
// The single place that warms the app before the user reaches a screen.
//
// It deliberately does two kinds of work:
//   - static merchandising config that is available even offline (instant);
//   - one efficient network pass for the catalog, app config and the
//     signed-in profile, all of which flow into the persistent cache.
// Nothing here is awaited by the splash past a short safety window: a slow or
// offline connection still gets a usable app, and the next launch starts from
// whatever was cached last time.
import { Image } from 'expo-image';

import { CATEGORIES, OCCASIONS, offerBusinessBanner, offerBusinessLogo } from './catalog';
import {
  defaultAppConfig,
  getAppConfig,
  selectFeaturedBusinesses,
  type AppConfig,
} from './app-config';
import { primeCache } from './cache';
import {
  listActiveOffers,
  listAppCategories,
  listMarketplaceBusinesses,
  primeBusinesses,
  primeOffers,
} from './data';
import { hasSupabaseConfig } from './env';
import { perfBetween, perfMark } from './perf';
import { getSupabase } from './supabase';
import type { MarketplaceBusiness, Offer } from './types';

const IMAGE_BUDGET = 14;
let catalogPromise: Promise<void> | null = null;
const warmedProfiles = new Set<string>();

/** The gift cards the "popular" shelf shows first. */
function popularOffers(rows: Offer[]): Offer[] {
  return [...rows]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.created_at.localeCompare(a.created_at))
    .slice(0, 6);
}

/** Warms the logos and banners that appear in the first viewport. */
function prefetchImages(offers: Offer[], businesses: MarketplaceBusiness[]): Promise<boolean> {
  const urls = new Set<string>();
  for (const business of businesses.slice(0, 8)) {
    if (business.logo_url) urls.add(business.logo_url);
    if (business.banner_url) urls.add(business.banner_url);
  }
  for (const offer of offers.slice(0, 6)) {
    const logo = offerBusinessLogo(offer);
    const banner = offerBusinessBanner(offer);
    if (logo) urls.add(logo);
    if (banner) urls.add(banner);
  }
  const list = [...urls].slice(0, IMAGE_BUDGET);
  if (list.length === 0) return Promise.resolve(false);
  return Image.prefetch(list, 'memory-disk').catch(() => false);
}

/**
 * Starts the marketplace bootstrap once. The returned promise is safe to
 * ignore: failures are swallowed so a bad connection never breaks startup.
 */
export function startCatalogBootstrap(): Promise<void> {
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    perfMark('bootstrap:start');

    // Static configuration is ready before any network call. Screens read the
    // same keys, so there is no second copy of the category definitions.
    primeCache('catalog:categories', CATEGORIES);
    primeCache('catalog:occasions', OCCASIONS);

    const tasks: Promise<unknown>[] = [
      listActiveOffers().catch(() => [] as Offer[]),
      listMarketplaceBusinesses().catch(() => [] as MarketplaceBusiness[]),
      listAppCategories().catch(() => []),
      getAppConfig(),
    ];
    const [offers, businesses, , rawConfig] = await Promise.all(tasks);
    const config = (rawConfig as AppConfig | undefined) ?? defaultAppConfig();
    const offerRows = Array.isArray(offers) ? (offers as Offer[]) : [];
    const businessRows = Array.isArray(businesses)
      ? (businesses as MarketplaceBusiness[])
      : [];
    const featured = selectFeaturedBusinesses(businessRows, [], config.featured);

    // listActiveOffers/listMarketplaceBusinesses already prime the individual
    // records; these derived shelves make the first screen a pure cache read.
    primeOffers(offerRows);
    primeBusinesses(businessRows);
    primeCache('businesses:featured', featured);
    primeCache('offers:popular', popularOffers(offerRows));

    perfMark('bootstrap:catalog');
    if (__DEV__) {
      console.debug('[perf] catalog primed in', perfBetween('bootstrap:start', 'bootstrap:catalog'), 'ms');
    }
    // Images are a separate, lower-priority track.
    void prefetchImages(offerRows, featured);
  })().catch(() => {
    // Cache hydration already gave us last launch's copy; keep it.
    perfMark('bootstrap:failed');
  });

  return catalogPromise;
}

/** Reads the signed-in user's display profile into the persistent cache. */
export function warmProfile(userId: string | null | undefined): Promise<void> {
  if (!userId || !hasSupabaseConfig || warmedProfiles.has(userId)) return Promise.resolve();
  warmedProfiles.add(userId);

  return (async () => {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('id, full_name, preferred_language')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) primeCache(`profile:${userId}`, data);
  })().catch(() => undefined);
}
