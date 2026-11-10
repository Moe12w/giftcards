// src/lib/catalog.ts
// Lightweight catalog helpers for the customer app. In production these come
// from the database; here they give the demo UI real structure.

import type { AccentTone, CategoryId, OccasionId, Offer } from './types';

export interface CatalogEntry {
  slug: string;
  emoji: string;
  tone: AccentTone;
  titleKey: string;
}

export const CATEGORIES: CatalogEntry[] = [
  { slug: 'coffee', emoji: '☕', tone: 'gold', titleKey: 'catalog.categories.coffee' },
  { slug: 'dining', emoji: '🍽️', tone: 'pink', titleKey: 'catalog.categories.dining' },
  { slug: 'desserts', emoji: '🧁', tone: 'pink', titleKey: 'catalog.categories.desserts' },
  { slug: 'wellness', emoji: '🌿', tone: 'teal', titleKey: 'catalog.categories.wellness' },
  { slug: 'shopping', emoji: '🛍️', tone: 'lavender', titleKey: 'catalog.categories.shopping' },
  { slug: 'experiences', emoji: '🏜️', tone: 'sky', titleKey: 'catalog.categories.experiences' },
  { slug: 'beauty', emoji: '💅', tone: 'lavender', titleKey: 'catalog.categories.beauty' },
  { slug: 'fitness', emoji: '🏋️', tone: 'teal', titleKey: 'catalog.categories.fitness' },
  { slug: 'entertainment', emoji: '🎬', tone: 'pink', titleKey: 'catalog.categories.entertainment' },
];

export const OCCASIONS: CatalogEntry[] = [
  { slug: 'birthday', emoji: '🎂', tone: 'pink', titleKey: 'catalog.occasions.birthday' },
  { slug: 'anniversary', emoji: '💞', tone: 'lavender', titleKey: 'catalog.occasions.anniversary' },
  { slug: 'wedding', emoji: '💍', tone: 'teal', titleKey: 'catalog.occasions.wedding' },
  { slug: 'graduation', emoji: '🎓', tone: 'gold', titleKey: 'catalog.occasions.graduation' },
  { slug: 'thank-you', emoji: '🙏', tone: 'teal', titleKey: 'catalog.occasions.thank-you' },
  {
    slug: 'congratulations',
    emoji: '🎉',
    tone: 'gold',
    titleKey: 'catalog.occasions.congratulations',
  },
  { slug: 'just-because', emoji: '✨', tone: 'lavender', titleKey: 'catalog.occasions.just-because' },
  { slug: 'seasonal', emoji: '❄️', tone: 'sky', titleKey: 'catalog.occasions.seasonal' },
];

export const COLLECTION_SLUGS = [
  'trending',
  'featured-businesses',
  'new-arrivals',
  'popular',
  'birthday',
  'anniversary',
  'wedding',
  'graduation',
  'thank-you',
  'congratulations',
  'just-because',
  'seasonal',
  'for-her',
  'for-him',
] as const;

export interface CuratedCollectionEntry {
  slug: string;
  emoji: string;
  tone: AccentTone;
  titleKey: string;
  subtitleKey: string;
}

/**
 * The editorial collections surfaced on the Explore homepage. They reuse the
 * existing collection routes so every card opens a real, filtered list.
 */
export const CURATED_COLLECTIONS: CuratedCollectionEntry[] = [
  {
    slug: 'birthday',
    emoji: '🎂',
    tone: 'pink',
    titleKey: 'catalog.collections.birthday.title',
    subtitleKey: 'catalog.collections.birthday.subtitle',
  },
  {
    slug: 'for-her',
    emoji: '💐',
    tone: 'lavender',
    titleKey: 'catalog.collections.for-her.title',
    subtitleKey: 'catalog.collections.for-her.subtitle',
  },
  {
    slug: 'for-him',
    emoji: '🕶️',
    tone: 'sky',
    titleKey: 'catalog.collections.for-him.title',
    subtitleKey: 'catalog.collections.for-him.subtitle',
  },
  {
    slug: 'thank-you',
    emoji: '🙏',
    tone: 'teal',
    titleKey: 'catalog.collections.thank-you.title',
    subtitleKey: 'catalog.collections.thank-you.subtitle',
  },
  {
    slug: 'just-because',
    emoji: '✨',
    tone: 'gold',
    titleKey: 'catalog.collections.just-because.title',
    subtitleKey: 'catalog.collections.just-because.subtitle',
  },
  {
    slug: 'anniversary',
    emoji: '💞',
    tone: 'pink',
    titleKey: 'catalog.collections.anniversary.title',
    subtitleKey: 'catalog.collections.anniversary.subtitle',
  },
  {
    slug: 'congratulations',
    emoji: '🎉',
    tone: 'gold',
    titleKey: 'catalog.collections.congratulations.title',
    subtitleKey: 'catalog.collections.congratulations.subtitle',
  },
];

const TONE_CYCLE: AccentTone[] = ['gold', 'teal', 'pink', 'lavender', 'sky'];
const EMOJI_CYCLE = ['🎁', '🎉', '✨', '💝', '🌟'];

export function offerTitle(offer: Offer, language: string): string {
  return language === 'ar' ? offer.title_ar ?? offer.title : offer.title;
}

export function offerEmoji(offer: Offer, index = 0): string {
  return offer.emoji ?? EMOJI_CYCLE[index % EMOJI_CYCLE.length];
}

export function offerTone(offer: Offer, index = 0): AccentTone {
  return offer.tone ?? TONE_CYCLE[index % TONE_CYCLE.length];
}

export function offersForCategory(offers: Offer[], category: CategoryId): Offer[] {
  return offers.filter((offer) => offer.category === category);
}

export function offersForOccasion(offers: Offer[], occasion: OccasionId): Offer[] {
  return offers.filter((offer) => offer.occasions?.includes(occasion));
}

export function offersForCollection(offers: Offer[], slug: string): Offer[] {
  const byRating = [...offers].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  switch (slug) {
    case 'trending':
    case 'popular':
      return byRating;
    case 'new-arrivals':
      return [...offers].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case 'featured-businesses':
      return byRating;
    case 'for-her':
      return offers.filter(
        (offer) =>
          (offer.category && ['beauty', 'wellness', 'shopping', 'desserts'].includes(offer.category)) ||
          offer.occasions?.includes('anniversary'),
      );
    case 'for-him':
      return offers.filter(
        (offer) =>
          offer.category &&
          ['fitness', 'experiences', 'entertainment', 'coffee'].includes(offer.category),
      );
    default:
      return offersForOccasion(offers, slug as OccasionId);
  }
}

/** Groups offers by vendor, keeping the highest-rated offer as the vendor's card. */
export function groupOffersByVendor(offers: Offer[]): Offer[] {
  const seen = new Set<string>();
  const result: Offer[] = [];
  for (const offer of [...offers].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))) {
    if (seen.has(offer.vendor_id)) continue;
    seen.add(offer.vendor_id);
    result.push(offer);
  }
  return result;
}

export function findOffer(offers: Offer[], id: string): Offer | null {
  return offers.find((offer) => offer.id === id) ?? null;
}

export function findBusiness(offers: Offer[], vendorId: string): Offer | null {
  return offers.find((offer) => offer.vendor_id === vendorId) ?? null;
}
