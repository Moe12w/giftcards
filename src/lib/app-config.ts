// src/lib/app-config.ts
// Remote merchandising controls for the customer app.
//
// The admin dashboard writes public rows in `system_settings`. This module
// turns those rows into a typed, always-usable configuration: a missing row, a
// malformed value or an offline launch falls back to the behaviour the app had
// before the controls existed. Nothing here is security-sensitive; it only
// decides what the app shows.
import { useCallback, useEffect, useState } from 'react';

import { cached, peekCache, primeCache } from './cache';
import { hasSupabaseConfig } from './env';
import { getSupabase } from './supabase';
import type { MarketplaceBusiness } from './types';

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

export interface HomeSectionSetting {
  key: HomeSectionKey;
  visible: boolean;
  order: number;
}

export type FeaturedMode = 'auto' | 'manual' | 'mixed';
export type FeaturedSort = 'gift_count' | 'rating';

export interface FeaturedSetting {
  mode: FeaturedMode;
  limit: number;
  partnerFirst: boolean;
  sort: FeaturedSort;
  prioritizeFeatured: boolean;
  businessIds: string[];
}

export interface CollectionSetting {
  slug: string;
  visible: boolean;
  order: number;
}

export interface MaintenanceSetting {
  enabled: boolean;
  message: string;
  messageAr: string;
}

export interface AnnouncementSetting {
  enabled: boolean;
  text: string;
  textAr: string;
}

export interface AppConfig {
  home: {
    sections: HomeSectionSetting[];
    trendingLimit: number;
    recommendedLimit: number;
  };
  featured: FeaturedSetting;
  categories: {
    homeLimit: number;
  };
  collections: {
    homeLimit: number;
    items: CollectionSetting[];
  };
  controls: {
    maintenance: MaintenanceSetting;
    announcement: AnnouncementSetting;
  };
}

const APP_CONFIG_KEYS = [
  'expo.home',
  'expo.featured',
  'expo.categories',
  'expo.collections',
  'expo.controls',
] as const;

const DEFAULT_COLLECTIONS: CollectionSetting[] = [
  { slug: 'birthday', visible: true, order: 10 },
  { slug: 'for-her', visible: true, order: 20 },
  { slug: 'for-him', visible: true, order: 30 },
  { slug: 'thank-you', visible: true, order: 40 },
  { slug: 'just-because', visible: true, order: 50 },
  { slug: 'anniversary', visible: true, order: 60 },
  { slug: 'congratulations', visible: true, order: 70 },
];

export function defaultAppConfig(): AppConfig {
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
    collections: { homeLimit: 7, items: DEFAULT_COLLECTIONS.map((item) => ({ ...item })) },
    controls: {
      maintenance: { enabled: false, message: '', messageAr: '' },
      announcement: { enabled: false, text: '', textAr: '' },
    },
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function asStringList(value: unknown, limit: number): string[] {
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

function parseSections(value: unknown): HomeSectionSetting[] {
  const raw = Array.isArray(value) ? value : [];
  return HOME_SECTION_KEYS.map((key, index) => {
    const entry = raw
      .map(asObject)
      .find((row) => asText(row.key) === key);
    return {
      key,
      visible: asBool(entry?.visible, true),
      order: asInt(entry?.order, (index + 1) * 10, 0, 10_000),
    };
  });
}

function parseFeatured(value: unknown): FeaturedSetting {
  const raw = asObject(value);
  const mode = asText(raw.mode);
  const sort = asText(raw.sort);
  return {
    mode: mode === 'manual' || mode === 'mixed' ? mode : 'auto',
    limit: asInt(raw.limit, 6, 1, 24),
    partnerFirst: asBool(raw.partnerFirst, true),
    sort: sort === 'rating' ? 'rating' : 'gift_count',
    prioritizeFeatured: asBool(raw.prioritizeFeatured, false),
    businessIds: asStringList(raw.businessIds, 50),
  };
}

function parseCollections(value: unknown): AppConfig['collections'] {
  const raw = asObject(value);
  const items = Array.isArray(raw.items)
    ? raw.items
        .map(asObject)
        .map((row) => ({
          slug: asText(row.slug),
          visible: asBool(row.visible, true),
          order: asInt(row.order, 0, 0, 10_000),
        }))
        .filter((row) => row.slug)
    : [];
  return {
    homeLimit: asInt(raw.homeLimit, 7, 1, 14),
    items: items.length > 0 ? items : DEFAULT_COLLECTIONS.map((item) => ({ ...item })),
  };
}

function parseControls(value: unknown): AppConfig['controls'] {
  const raw = asObject(value);
  const maintenance = asObject(raw.maintenance);
  const announcement = asObject(raw.announcement);
  return {
    maintenance: {
      enabled: asBool(maintenance.enabled, false),
      message: asText(maintenance.message),
      messageAr: asText(maintenance.messageAr),
    },
    announcement: {
      enabled: asBool(announcement.enabled, false),
      text: asText(announcement.text),
      textAr: asText(announcement.textAr),
    },
  };
}

/** Merges the public setting rows into one typed configuration. */
export function parseAppConfig(rows: { key: string; value: unknown }[]): AppConfig {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const defaults = defaultAppConfig();
  const home = asObject(byKey.get('expo.home'));
  const categories = asObject(byKey.get('expo.categories'));

  return {
    home: {
      sections: parseSections(home.sections),
      trendingLimit: asInt(home.trendingLimit, defaults.home.trendingLimit, 1, 24),
      recommendedLimit: asInt(home.recommendedLimit, defaults.home.recommendedLimit, 1, 12),
    },
    featured: parseFeatured(byKey.get('expo.featured')),
    categories: {
      homeLimit: asInt(categories.homeLimit, defaults.categories.homeLimit, 1, 24),
    },
    collections: parseCollections(byKey.get('expo.collections')),
    controls: parseControls(byKey.get('expo.controls')),
  };
}

/**
 * Reads the public app configuration. A failed request keeps the last cached
 * copy (or the defaults) so the home screen never breaks because of config.
 */
export async function getAppConfig(): Promise<AppConfig> {
  return cached<AppConfig>('app:config', 60_000, async () => {
    if (!hasSupabaseConfig) return defaultAppConfig();
    try {
      const { data, error } = await getSupabase()
        .from('system_settings')
        .select('key, value')
        .in('key', [...APP_CONFIG_KEYS]);
      if (error) return defaultAppConfig();
      return parseAppConfig((data ?? []) as { key: string; value: unknown }[]);
    } catch {
      return defaultAppConfig();
    }
  });
}

/**
 * Fetches the config directly for a foreground refresh. Unlike `cached()`, a
 * failed request keeps the last good copy instead of replacing it with
 * defaults, so going offline never hides the admin's settings.
 */
export async function refreshAppConfig(): Promise<AppConfig> {
  if (!hasSupabaseConfig) return peekAppConfig();
  try {
    const { data, error } = await getSupabase()
      .from('system_settings')
      .select('key, value')
      .in('key', [...APP_CONFIG_KEYS]);
    if (error) return peekAppConfig();
    const next = parseAppConfig((data ?? []) as { key: string; value: unknown }[]);
    primeCache('app:config', next);
    return next;
  } catch {
    return peekAppConfig();
  }
}

/** The last configuration this launch has seen, ready for first paint. */
export function peekAppConfig(): AppConfig {
  return peekCache<AppConfig>('app:config') ?? defaultAppConfig();
}

/** Loads the remote configuration once and updates when it arrives. */
export function useAppConfig(): { config: AppConfig; refresh: () => Promise<void> } {
  const [config, setConfig] = useState<AppConfig>(() => peekAppConfig());

  useEffect(() => {
    let active = true;
    getAppConfig()
      .then((next) => {
        if (active) setConfig(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await refreshAppConfig();
    setConfig(next);
  }, []);

  return { config, refresh };
}

/**
 * Applies the featured-business rules to the directory.
 *
 * `manualRows` must already be in the admin's order. `mixed` shows those first
 * and fills the remaining slots from the automatic ranking.
 */
export function selectFeaturedBusinesses(
  rows: MarketplaceBusiness[],
  manualRows: MarketplaceBusiness[],
  setting: FeaturedSetting,
): MarketplaceBusiness[] {
  if (setting.mode === 'manual') return manualRows.slice(0, setting.limit);

  const manual = setting.mode === 'mixed' ? manualRows.slice(0, setting.limit) : [];
  const manualIds = new Set(manual.map((row) => row.id));
  const remaining = Math.max(0, setting.limit - manual.length);
  const auto = [...rows]
    .filter((row) => !manualIds.has(row.id))
    .sort((a, b) => {
      if (setting.prioritizeFeatured && a.is_featured !== b.is_featured) {
        return a.is_featured ? -1 : 1;
      }
      if (setting.partnerFirst && a.business_kind !== b.business_kind) {
        return a.business_kind === 'partner' ? -1 : 1;
      }
      const primary =
        setting.sort === 'rating'
          ? (b.rating ?? 0) - (a.rating ?? 0)
          : b.gift_count - a.gift_count;
      return primary !== 0 ? primary : (b.rating ?? 0) - (a.rating ?? 0);
    })
    .slice(0, remaining);

  return [...manual, ...auto];
}

/** Orders and filters collection tiles using the saved configuration. */
export function configuredCollections<T extends { slug: string }>(
  setting: AppConfig['collections'],
  entries: T[],
): T[] {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  return [...setting.items]
    .filter((item) => item.visible)
    .sort((a, b) => a.order - b.order)
    .map((item) => bySlug.get(item.slug))
    .filter((entry): entry is T => Boolean(entry))
    .slice(0, setting.homeLimit);
}
