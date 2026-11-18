// src/lib/navigation.ts
// Guards against accidental double taps pushing the same screen twice.
import { router } from 'expo-router';

import { offerBusinessLogo } from './catalog';
import type { Offer } from './types';

const DOUBLE_TAP_MS = 700;

let lastHref: string | null = null;
let lastPushedAt = 0;

/**
 * Push a route once. A second tap on the same route within `windowMs` is
 * ignored, so a quick double tap can't stack two identical screens.
 */
export function pushOnce(href: string, windowMs = DOUBLE_TAP_MS): void {
  const now = Date.now();
  if (href === lastHref && now - lastPushedAt < windowMs) return;
  lastHref = href;
  lastPushedAt = now;
  router.push(href as never);
}

/**
 * Builds the business route with the name and logo carried in the params.
 * The detail screen can then paint the correct title and artwork on its first
 * frame instead of showing a generic "Business" heading while it fetches.
 */
export function businessHref(business: {
  id: string;
  name?: string | null;
  logo_url?: string | null;
}): string {
  const params = new URLSearchParams();
  if (business.name) params.set('name', business.name);
  if (business.logo_url) params.set('logo', business.logo_url);
  const query = params.toString();
  return `/(customer)/business/${business.id}${query ? `?${query}` : ''}`;
}

/** Warms the route bundle before the finger lifts. */
export function prefetchBusiness(business: {
  id: string;
  name?: string | null;
  logo_url?: string | null;
}): void {
  router.prefetch(businessHref(business) as never);
}

/**
 * Carries the title and logo into the gift route so its first frame shows the
 * real gift instead of a generic heading. The screen still refreshes the full
 * record in the background.
 */
export function giftHref(offer: Offer, language?: string): string {
  const params = new URLSearchParams();
  const title = language === 'ar' ? offer.title_ar ?? offer.title : offer.title;
  if (title) params.set('title', title);
  const logo = offerBusinessLogo(offer);
  if (logo) params.set('logo', logo);
  const query = params.toString();
  return `/(customer)/gift/${offer.id}${query ? `?${query}` : ''}`;
}

/** Warms a gift route before the finger lifts. */
export function prefetchGift(offer: Offer | string, language?: string): void {
  const href =
    typeof offer === 'string' ? `/(customer)/gift/${offer}` : giftHref(offer, language);
  router.prefetch(href as never);
}

/** Warms a wallet card route before the finger lifts. */
export function cardHref(card: {
  id: string;
  name?: string | null;
  logo?: string | null;
}): string {
  const params = new URLSearchParams();
  if (card.name) params.set('name', card.name);
  if (card.logo) params.set('logo', card.logo);
  const query = params.toString();
  return `/(customer)/card/${card.id}${query ? `?${query}` : ''}`;
}

export function prefetchCard(cardId: string): void {
  router.prefetch(`/(customer)/card/${cardId}` as never);
}
