// src/lib/search.ts
// Fuzzy, bilingual (English + Arabic) search for the customer app.
//
// The customer-facing search used to run a single case-insensitive substring
// check, so typos and Arabic queries mostly missed. This module adds:
// - diacritic / tatweel / punctuation normalization (Arabic-friendly),
// - token-based fuzzy matching (typo-tolerant subsequence scoring),
// - weighted multi-field scoring (title, Arabic title, business name, description,
//   category, occasion, location),
// - intent-style discovery (e.g. "spa couples" lifts wellness and celebration hits).

import type { Offer } from './types';
import { offerBusinessName } from './catalog';

export interface SearchField {
  /** Relative importance of the field; higher ranks stronger matches. */
  weight: number;
  /** Raw field value. Normalized internally. */
  text: string;
}

/** Lowercase and strip diacritics, tatweel and punctuation; keeps Arabic letters. */
export function normalizeSearchText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[\u0640\u064B-\u065F\u0670]/g, '')
    .replace(/[^a-z0-9\u0600-\u08FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a normalized string into searchable tokens. */
export function tokenizeSearch(value: string | null | undefined): string[] {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

/**
 * Typo-tolerant similarity between two normalized tokens, in the range
 * 0..1. Substring hits score high, full subsequence coverage scores lower
 * (covers small typos), partial coverage scores lower still.
 */
export function fuzzyTokenScore(queryToken: string, targetToken: string): number {
  const q = queryToken.trim();
  const t = targetToken.trim();
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.includes(q) || q.includes(t)) return 0.9;
  let qi = 0;
  let ti = 0;
  let matched = 0;
  while (qi < q.length && ti < t.length) {
    if (q.charCodeAt(qi) === t.charCodeAt(ti)) {
      matched += 1;
      qi += 1;
    }
    ti += 1;
  }
  const coverage = matched / q.length;
  if (coverage <= 0) return 0;
  const ratio = Math.min(q.length, t.length) / Math.max(q.length, t.length);
  const score = 0.65 * coverage * (0.7 + 0.3 * ratio);
  return Math.max(0.15, Math.min(0.89, score));
}

/**
 * Weighted score for a query against a list of fields. Every query token must
 * fuzzy-match at least once; the score sums the best field hit per token.
 */
export function searchScore(query: string, fields: SearchField[]): number {
  const tokens = tokenizeSearch(query);
  if (tokens.length === 0) return 0;
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      const score = field.weight * fuzzyTokenScore(token, field.text);
      if (score > best) best = score;
    }
    if (best <= 0) return 0;
    total += best;
  }
  return total;
}

export interface OfferSearchIntent {
  categorySlugs: string[];
  occasionSlugs: string[];
  /** Extra points added when the offer belongs to this intent. */
  boost: number;
}

interface Intent extends OfferSearchIntent {
  keywords: string[];
}

const INTENTS: Intent[] = [
  { keywords: ['spa', 'massage', 'beaut', 'wellness', 'relax', 'facial', 'manicure', 'nail', 'aesthet'], categorySlugs: ['wellness', 'beauty'], occasionSlugs: [], boost: 3 },
  { keywords: ['fit', 'yoga', 'workout', 'gym', 'pilat', 'train', 'exerc', 'hiit', 'crossfit', 'health'], categorySlugs: ['fitness'], occasionSlugs: [], boost: 3 },
  { keywords: ['coffe', 'cafe', 'espresso', 'latte', 'brunch', 'bakery', 'bakeri'], categorySlugs: ['coffee'], occasionSlugs: [], boost: 3 },
  { keywords: ['dinin', 'restaur', 'food', 'meal', 'dinn', 'lunch', 'breakfast', 'bbq', 'grill', 'foodie', 'foodtur'], categorySlugs: ['dining'], occasionSlugs: [], boost: 3 },
  { keywords: ['dessert', 'cake', 'sweet', 'icecream', 'chocolate', 'cupcake'], categorySlugs: ['desserts'], occasionSlugs: [], boost: 3 },
  { keywords: ['shopp', 'store', 'fashion', 'jewel', 'perfum', 'florist', 'boutiqu', 'gift'], categorySlugs: ['shopping'], occasionSlugs: [], boost: 3 },
  { keywords: ['entertain', 'movie', 'cinema', 'karaoke', 'escape', 'puzzle', 'game', 'fun'], categorySlugs: ['entertainment'], occasionSlugs: [], boost: 3 },
  { keywords: ['experi', 'adventur', 'trip', 'tour', 'park', 'hike', 'muse', 'activity', 'outing', 'famil'], categorySlugs: ['experiences'], occasionSlugs: [], boost: 3 },
];

const OCCASION_INTENTS: Record<string, OfferSearchIntent> = {
  birthday: { categorySlugs: [], occasionSlugs: ['birthday'], boost: 3 },
  anniversary: { categorySlugs: [], occasionSlugs: ['anniversary'], boost: 3 },
  wedding: { categorySlugs: [], occasionSlugs: ['wedding'], boost: 3 },
  graduation: { categorySlugs: [], occasionSlugs: ['graduation'], boost: 3 },
  thankyou: { categorySlugs: [], occasionSlugs: ['thank-you'], boost: 3 },
  congratulations: { categorySlugs: [], occasionSlugs: ['congratulations'], boost: 3 },
  justbecause: { categorySlugs: [], occasionSlugs: ['just-because'], boost: 3 },
  love: { categorySlugs: [], occasionSlugs: ['anniversary', 'just-because'], boost: 3 },
};

function resolveIntent(tokens: string[]): OfferSearchIntent | null {
  let resolved: OfferSearchIntent | null = null;
  let bestBoost = 0;
  for (const token of tokens) {
    for (const intent of INTENTS) {
      if (intent.keywords.includes(token) || token.startsWith(intent.keywords[0])) {
        if (intent.boost > bestBoost) {
          resolved = { categorySlugs: intent.categorySlugs, occasionSlugs: intent.occasionSlugs, boost: intent.boost };
          bestBoost = intent.boost;
        }
      }
    }
    const occasion = OCCASION_INTENTS[token];
    if (occasion && occasion.boost > bestBoost) {
      resolved = occasion;
      bestBoost = occasion.boost;
    }
  }
  return resolved;
}

/** Weighted fields describing what an offer is about, in the customer's language. */
export function offerSearchFields(offer: Offer, language: string): SearchField[] {
  const title = language === 'ar' ? offer.title_ar ?? offer.title : offer.title;
  return [
    { weight: 10, text: offer.title },
    { weight: 10, text: offer.title_ar ?? '' },
    { weight: 9, text: title },
    { weight: 8, text: offerBusinessName(offer) },
    { weight: 8, text: offer.partner?.name ?? '' },
    { weight: 6, text: offer.description ?? '' },
    { weight: 5, text: offer.category ?? '' },
    { weight: 5, text: offer.occasions?.join(' ') ?? '' },
    { weight: 3, text: offer.location ?? '' },
  ];
}

/**
 * Fuzzy, bilingual, intent-aware search over the active gift catalogue. An
 * empty query returns the full list in its current order.
 */
export function searchOffers(offers: Offer[], query: string, language = 'en'): Offer[] {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return offers;
  const tokens = tokenizeSearch(trimmed);
  const intent = resolveIntent(tokens);
  const scored = offers
    .map((offer, index) => ({ offer, index, score: offerSearchScore(offer, trimmed, intent, language) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((entry) => entry.offer);
}

function offerSearchScore(
  offer: Offer,
  trimmed: string,
  intent: OfferSearchIntent | null,
  language: string,
): number {
  const score = searchScore(trimmed, offerSearchFields(offer, language));
  if (score <= 0) return 0;
  if (intent) {
    const category = offer.category ?? '';
    const occasion = offer.occasions?.[0];
    const categoryHit = intent.categorySlugs.includes(category);
    const occasionHit = Boolean(occasion) && intent.occasionSlugs.includes(String(occasion));
    if (categoryHit || occasionHit) return score + intent.boost;
  }
  return score;
}

/**
 * Fuzzy, bilingual directory search over marketplace businesses. An empty
 * query returns the full list in its current order.
 */
export function searchBusinesses(
  businesses: Array<{
    id: string;
    name: string;
    description?: string | null;
    area?: string | null;
    city?: string | null;
    rating?: number | null;
  }>,
  query: string,
): Array<{
  id: string;
  name: string;
  description?: string | null;
  area?: string | null;
  city?: string | null;
  rating?: number | null;
}> {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return businesses;
  const scored = businesses
    .map((business, index) => {
      const score = searchScore(trimmed, [
        { weight: 10, text: business.name },
        { weight: 6, text: business.description ?? '' },
        { weight: 4, text: business.area ?? '' },
        { weight: 3, text: business.city ?? '' },
      ]);
      return { business, index, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((entry) => entry.business);
}
