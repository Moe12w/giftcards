// web/lib/expo-app-config.ts
// Server-side view of the configuration the Expo app reads from
// `system_settings`. Keeping the defaults here means the admin forms always
// show exactly what the app will fall back to.

import type { requireAdmin } from '@/lib/auth';

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>['supabase'];

export const HOME_SECTION_KEYS = [
  'heroCarousel',
  'featuredBusinesses',
  'activeBasket',
  'heroCard',
  'categories',
  'collections',
  'sponsoredGifts',
  'trending',
  'recommended',
] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  heroCarousel: 'Sponsored hero carousel',
  featuredBusinesses: 'Featured businesses',
  activeBasket: 'Active basket strip',
  heroCard: 'Promo hero card',
  categories: 'Categories',
  collections: 'Collections',
  sponsoredGifts: 'Sponsored gift cards',
  trending: 'Trending gifts',
  recommended: 'Recommended gifts',
};

export const COLLECTION_TILES: { slug: string; label: string }[] = [
  { slug: 'birthday', label: 'Birthday' },
  { slug: 'for-her', label: 'For her' },
  { slug: 'for-him', label: 'For him' },
  { slug: 'thank-you', label: 'Thank you' },
  { slug: 'just-because', label: 'Just because' },
  { slug: 'anniversary', label: 'Anniversary' },
  { slug: 'congratulations', label: 'Congratulations' },
];

export const CONFIG_KEYS = [
  'expo.home',
  'expo.featured',
  'expo.categories',
  'expo.collections',
  'expo.controls',
] as const;

export interface HomeSectionSetting {
  key: HomeSectionKey;
  visible: boolean;
  order: number;
}
export interface FeaturedSetting {
  mode: 'auto' | 'manual' | 'mixed';
  limit: number;
  partnerFirst: boolean;
  sort: 'gift_count' | 'rating';
  prioritizeFeatured: boolean;
  businessIds: string[];
}
export interface CollectionSetting {
  slug: string;
  visible: boolean;
  order: number;
}
export interface ExpoConfig {
  home: {
    sections: HomeSectionSetting[];
    trendingLimit: number;
    recommendedLimit: number;
  };
  featured: FeaturedSetting;
  categories: { homeLimit: number };
  collections: { homeLimit: number; items: CollectionSetting[] };
  controls: {
    maintenance: { enabled: boolean; message: string; messageAr: string };
    announcement: { enabled: boolean; text: string; textAr: string };
  };
}

export function defaultExpoConfig(): ExpoConfig {
  return {
    home: {
      sections: HOME_SECTION_KEYS.map((key, index) => ({
        key,
        visible: true,
        order: (index + 1) * 10,
      })),
      trendingLimit: 8,
      recommendedLimit: 3,
    },
    featured: {
      mode: 'auto',
      limit: 6,
      partnerFirst: true,
      sort: 'gift_count',
      prioritizeFeatured: false,
      businessIds: [],
    },
    categories: { homeLimit: 9 },
    collections: {
      homeLimit: 7,
      items: COLLECTION_TILES.map((tile, index) => ({
        slug: tile.slug,
        visible: true,
        order: (index + 1) * 10,
      })),
    },
    controls: {
      maintenance: { enabled: false, message: '', messageAr: '' },
      announcement: { enabled: false, text: '', textAr: '' },
    },
  };
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
function int(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}
function list(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push(id);
    if (rows.length >= limit) break;
  }
  return rows;
}

export function parseExpoConfig(rows: { key: string; value: unknown }[]): ExpoConfig {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const defaults = defaultExpoConfig();
  const home = obj(byKey.get('expo.home'));
  const featured = obj(byKey.get('expo.featured'));
  const categories = obj(byKey.get('expo.categories'));
  const collections = obj(byKey.get('expo.collections'));
  const controls = obj(byKey.get('expo.controls'));
  const maintenance = obj(controls.maintenance);
  const announcement = obj(controls.announcement);
  const sectionRows = Array.isArray(home.sections) ? home.sections : [];
  const collectionRows = Array.isArray(collections.items) ? collections.items : [];
  const mode = text(featured.mode);
  const sort = text(featured.sort);

  return {
    home: {
      sections: HOME_SECTION_KEYS.map((key, index) => {
        const entry = sectionRows
          .map(obj)
          .find((row) => text(row.key) === key);
        return {
          key,
          visible: bool(entry?.visible, true),
          order: int(entry?.order, (index + 1) * 10, 0, 10_000),
        };
      }),
      trendingLimit: int(home.trendingLimit, defaults.home.trendingLimit, 1, 24),
      recommendedLimit: int(
        home.recommendedLimit,
        defaults.home.recommendedLimit,
        1,
        12,
      ),
    },
    featured: {
      mode: mode === 'manual' || mode === 'mixed' ? mode : 'auto',
      limit: int(featured.limit, defaults.featured.limit, 1, 24),
      partnerFirst: bool(featured.partnerFirst, true),
      sort: sort === 'rating' ? 'rating' : 'gift_count',
      prioritizeFeatured: bool(featured.prioritizeFeatured, false),
      businessIds: list(featured.businessIds, 50),
    },
    categories: {
      homeLimit: int(categories.homeLimit, defaults.categories.homeLimit, 1, 24),
    },
    collections: {
      homeLimit: int(collections.homeLimit, defaults.collections.homeLimit, 1, 14),
      items:
        collectionRows.length > 0
          ? collectionRows
              .map(obj)
              .map((row) => ({
                slug: text(row.slug),
                visible: bool(row.visible, true),
                order: int(row.order, 0, 0, 10_000),
              }))
              .filter((row) => row.slug)
          : defaults.collections.items,
    },
    controls: {
      maintenance: {
        enabled: bool(maintenance.enabled, false),
        message: text(maintenance.message),
        messageAr: text(maintenance.messageAr),
      },
      announcement: {
        enabled: bool(announcement.enabled, false),
        text: text(announcement.text),
        textAr: text(announcement.textAr),
      },
    },
  };
}

/** Reads the current app configuration through the admin's RLS session. */
export async function readExpoConfig(supabase: AdminClient): Promise<ExpoConfig> {
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [...CONFIG_KEYS]);
  return parseExpoConfig((data ?? []) as { key: string; value: unknown }[]);
}
