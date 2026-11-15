// web/lib/search.ts
// Fuzzy, bilingual (English + Arabic) search over public catalogue listings.
//
// The public directory search used to run a single PostgREST `ilike` filter, so
// typos and Arabic text mostly missed. This module keeps the same fields but
// adds diacritic/punctuation-insensitive normalization, token-based fuzzy
// matching and weighted scoring, then ranks the best hits first.

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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
  const q = normalizeSearchText(queryToken);
  const t = normalizeSearchText(targetToken);
  if (!q || !t) return 0;
  if (q === t) return 1;

  // Plural / inflection boost: target is query plus a common suffix (or the
  // reverse). Keeps "spa"->"spas" and "coffee"->"coffees" without letting
  // unrelated words that merely start with the query through.
  const INFLECTION_SUFFIXES = ['', 's', 'es', 'ed', 'ing', 'er', 'est', 'ly', 'y', 'ies', 'd'];
  if (q.length >= 3 && t.startsWith(q)) {
    const suffix = t.slice(q.length);
    if (INFLECTION_SUFFIXES.includes(suffix)) return 0.9;
  }
  if (t.length >= 3 && q.startsWith(t)) {
    const suffix = q.slice(t.length);
    if (INFLECTION_SUFFIXES.includes(suffix)) return 0.9;
  }

  // Typo tolerance via subsequence matching.
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
  if (coverage < 0.6) return 0;

  const isPrefix = t.startsWith(q) || q.startsWith(t);
  const suffix = isPrefix
    ? t.length > q.length
      ? t.slice(q.length)
      : q.slice(t.length)
    : '';
  const allowedSuffix =
    INFLECTION_SUFFIXES.includes(suffix) ||
    (suffix.length >= 1 && suffix.length <= 2 && /^[aeiouy]+$/i.test(suffix));
  if (isPrefix && suffix.length > 0 && !allowedSuffix) return 0;
  const smallDiff = Math.abs(t.length - q.length) <= 2 && allowedSuffix;
  if (!(isPrefix && smallDiff)) {
    if (coverage < 0.85) return 0;
  }

  const ratio = Math.min(q.length, t.length) / Math.max(q.length, t.length);
  if (ratio < 0.7) return 0;

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
      const targetTokens = tokenizeSearch(field.text);
      const candidates = targetTokens.length > 0 ? targetTokens : [normalizeSearchText(field.text)];
      for (const targetToken of candidates) {
        const score = field.weight * fuzzyTokenScore(token, targetToken);
        if (score > best) best = score;
      }
    }
    if (best <= 0) return 0;
    total += best;
  }
  return total;
}

export interface SearchableBusiness {
  id: string;
  name: string;
  description?: string | null;
  area?: string | null;
  city?: string | null;
  rating?: number | null;
}

/**
 * Fuzzy, bilingual directory search over public marketplace businesses. An
 * empty query returns the full list in its current order.
 */
export function searchBusinesses(
  businesses: SearchableBusiness[],
  query: string,
): SearchableBusiness[] {
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
