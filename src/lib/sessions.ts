// src/lib/sessions.ts
// Rules for session based gift cards.
//
// A regular gift card holds money: every redemption spends an amount and the
// balance goes down. An experience gift card holds *sessions* — one massage,
// one class, one night at the hotel. The price of the package is still money,
// but what the holder spends is a session, and the card is finished when the
// last session is used.

import type { GiftCard, Offer, RedemptionEntry, FulfilmentType } from './types';

export const VALUE_MODE: FulfilmentType = 'monetary';
export const SESSION_MODE: FulfilmentType = 'experience';

/** A session card always has at least one session. */
export const DEFAULT_SESSION_COUNT = 1;

/** Reads the redemption mode of an offer or card, defaulting to money. */
export function redemptionMode(
  source: { fulfilment_type?: FulfilmentType | null } | null | undefined,
): FulfilmentType {
  return source?.fulfilment_type === SESSION_MODE ? SESSION_MODE : VALUE_MODE;
}

/** True when the offer is redeemed one session at a time. */
export function isSessionOffer(
  offer: Pick<Offer, 'fulfilment_type'> | null | undefined,
): boolean {
  return redemptionMode(offer) === SESSION_MODE;
}

/** True when the card is redeemed one session at a time. */
export function isSessionCard(card: Pick<GiftCard, 'fulfilment_type'> | null | undefined): boolean {
  return redemptionMode(card) === SESSION_MODE;
}

/** Sessions included on the card. */
export function sessionTotal(card: Pick<GiftCard, 'total_sessions'>): number {
  const total = card.total_sessions ?? DEFAULT_SESSION_COUNT;
  return Math.max(0, Math.trunc(total));
}

/** Sessions used so far, counted from the append-only redemption log. */
export function sessionsUsed(entries: RedemptionEntry[]): number {
  return entries.reduce(
    (sum, entry) => (entry.kind === 'session' ? sum + (entry.sessions ?? 0) : sum),
    0,
  );
}

/** Sessions still available on the card. Value cards never hold sessions. */
export function sessionsRemaining(
  card: Pick<GiftCard, 'total_sessions' | 'remaining_sessions' | 'fulfilment_type'>,
  entries: RedemptionEntry[] = [],
): number {
  if (!isSessionCard(card)) return 0;
  const total = sessionTotal(card);
  const used = sessionsUsed(entries);
  // The stored remaining count wins when the log is empty (not yet hydrated).
  if (used === 0 && typeof card.remaining_sessions === 'number') {
    return Math.max(0, Math.min(total, card.remaining_sessions));
  }
  return Math.max(0, total - used);
}

/** A session card can only be redeemed while it still has sessions. */
export function canRedeemSession(
  card: Pick<GiftCard, 'total_sessions' | 'remaining_sessions' | 'status' | 'fulfilment_type'>,
  entries: RedemptionEntry[] = [],
): boolean {
  if (card.status === 'redeemed' || card.status === 'expired' || card.status === 'voided') {
    return false;
  }
  return sessionsRemaining(card, entries) > 0;
}

/** Remaining sessions after one is used. */
export function consumeSession(
  card: Pick<GiftCard, 'total_sessions' | 'remaining_sessions' | 'fulfilment_type'>,
  entries: RedemptionEntry[] = [],
): number {
  return Math.max(0, sessionsRemaining(card, entries) - 1);
}

/** 0 → 1 progress of the sessions used, for the meter component. */
export function sessionProgress(
  card: Pick<GiftCard, 'total_sessions' | 'remaining_sessions' | 'fulfilment_type'>,
  entries: RedemptionEntry[] = [],
): number {
  const total = sessionTotal(card);
  if (total <= 0) return 1;
  const remaining = sessionsRemaining(card, entries);
  return Math.max(0, Math.min(1, 1 - remaining / total));
}

/** Money still outstanding on a value card. */
export function valueRemaining(
  card: Pick<GiftCard, 'balance_minor' | 'original_value_minor'>,
  entries: RedemptionEntry[] = [],
): number {
  const spent = entries.reduce(
    (sum, entry) => (entry.kind === 'monetary' ? sum + (entry.amount_minor ?? 0) : sum),
    0,
  );
  if (spent === 0) return card.balance_minor ?? card.original_value_minor;
  return Math.max(0, (card.balance_minor ?? card.original_value_minor) - spent);
}

/** The card is finished once its last session is used. */
export function isSessionExhausted(
  card: Pick<GiftCard, 'total_sessions' | 'remaining_sessions' | 'fulfilment_type'>,
  entries: RedemptionEntry[] = [],
): boolean {
  return sessionsRemaining(card, entries) === 0;
}
