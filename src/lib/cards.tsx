// src/lib/cards.tsx
// The gift card ledger for the demo app.
//
// Money cards keep a balance that the vendor spends in amounts. Experience
// cards keep a number of sessions: every redemption uses exactly one, and the
// card is finished when the last one is gone. Both live in the same append-only
// redemption log so the customer app and the vendor dashboard always agree.
//
// In production the same actions map onto the `redeem_card` and
// `redeem_session` functions from supabase/migrations.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MOCK_CARDS, MOCK_REDEMPTIONS, MOCK_VENDOR_CARDS } from './mock-data';
import {
  canRedeemSession,
  isSessionCard,
  sessionsRemaining,
  valueRemaining,
} from './sessions';
import type { GiftCard, RedemptionEntry } from './types';

const STORAGE_KEY = 'giftly.cards.v1';

export interface CardStoreState {
  cards: GiftCard[];
  entries: RedemptionEntry[];
}

export interface CardsContextValue {
  ready: boolean;
  cards: GiftCard[];
  entries: RedemptionEntry[];
  /** Cards bought by the signed-in customer. */
  myCards: GiftCard[];
  getCard: (id: string) => GiftCard | null;
  /** Cards issued by one vendor — the vendor dashboard list. */
  cardsForVendor: (vendorId: string) => GiftCard[];
  entriesFor: (cardId: string) => RedemptionEntry[];
  /** Sessions left on a card (0 for money cards). */
  sessionsLeft: (card: GiftCard) => number;
  /** Money left on a card (0 for session cards). */
  valueLeft: (card: GiftCard) => number;
  canRedeem: (card: GiftCard) => boolean;
  /** Uses one session on an experience card. Returns the new entry. */
  redeemSession: (cardId: string, actor: string, note?: string) => RedemptionEntry | null;
  /** Spends an amount on a money card. Returns the new entry. */
  redeemValue: (cardId: string, amountMinor: number, actor: string) => RedemptionEntry | null;
}

const CardsContext = createContext<CardsContextValue | null>(null);

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function seed(): CardStoreState {
  return {
    cards: [...MOCK_CARDS, ...MOCK_VENDOR_CARDS],
    entries: [...MOCK_REDEMPTIONS],
  };
}

export function CardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CardStoreState>({ cards: [], entries: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as CardStoreState;
            if (parsed && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
              setState({ cards: parsed.cards, entries: parsed.entries ?? [] });
              return;
            }
          } catch {
            // Fall through to the seeded demo cards.
          }
        }
        setState(seed());
      })
      .catch(() => active && setState(seed()))
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [state, ready]);

  const getCard = useCallback(
    (id: string) => state.cards.find((card) => card.id === id) ?? null,
    [state.cards],
  );

  const entriesFor = useCallback(
    (cardId: string) => state.entries.filter((entry) => entry.card_id === cardId),
    [state.entries],
  );

  const cardsForVendor = useCallback(
    (vendorId: string) => state.cards.filter((card) => card.vendor_id === vendorId),
    [state.cards],
  );

  const myCards = useMemo(
    () => state.cards.filter((card) => card.buyer_id === 'demo-user'),
    [state.cards],
  );

  const sessionsLeft = useCallback(
    (card: GiftCard) => sessionsRemaining(card, entriesFor(card.id)),
    [entriesFor],
  );

  const valueLeft = useCallback(
    (card: GiftCard) => valueRemaining(card, entriesFor(card.id)),
    [entriesFor],
  );

  const canRedeem = useCallback(
    (card: GiftCard) => {
      if (isSessionCard(card)) return canRedeemSession(card, entriesFor(card.id));
      return (
        card.status !== 'redeemed' &&
        card.status !== 'expired' &&
        card.status !== 'voided' &&
        valueRemaining(card, entriesFor(card.id)) > 0
      );
    },
    [entriesFor],
  );

  const redeemSession = useCallback(
    (cardId: string, actor: string, note?: string) => {
      const card = state.cards.find((candidate) => candidate.id === cardId);
      if (!card || !isSessionCard(card)) return null;
      const entries = state.entries.filter((entry) => entry.card_id === cardId);
      if (!canRedeemSession(card, entries)) return null;

      const entry: RedemptionEntry = {
        id: makeId('redemption'),
        card_id: cardId,
        kind: 'session',
        sessions: 1,
        actor,
        created_at: new Date().toISOString(),
        note,
      };

      const remaining = sessionsRemaining(card, entries) - 1;

      setState((prev) => ({
        cards: prev.cards.map((candidate) =>
          candidate.id === cardId
            ? {
                ...candidate,
                remaining_sessions: remaining,
                status: remaining <= 0 ? 'redeemed' : candidate.status,
                balance_minor: candidate.balance_minor ?? 0,
              }
            : candidate,
        ),
        entries: [...prev.entries, entry],
      }));

      return entry;
    },
    [state.cards, state.entries],
  );

  const redeemValue = useCallback(
    (cardId: string, amountMinor: number, actor: string) => {
      const card = state.cards.find((candidate) => candidate.id === cardId);
      if (!card || isSessionCard(card)) return null;
      const entries = state.entries.filter((entry) => entry.card_id === cardId);
      const remaining = valueRemaining(card, entries);
      if (amountMinor <= 0 || amountMinor > remaining) return null;

      const entry: RedemptionEntry = {
        id: makeId('redemption'),
        card_id: cardId,
        kind: 'monetary',
        amount_minor: amountMinor,
        actor,
        created_at: new Date().toISOString(),
      };

      const left = remaining - amountMinor;

      setState((prev) => ({
        cards: prev.cards.map((candidate) =>
          candidate.id === cardId
            ? {
                ...candidate,
                balance_minor: left,
                status: left === 0 ? 'redeemed' : candidate.status,
              }
            : candidate,
        ),
        entries: [...prev.entries, entry],
      }));

      return entry;
    },
    [state.cards, state.entries],
  );

  const value = useMemo<CardsContextValue>(
    () => ({
      ready,
      cards: state.cards,
      entries: state.entries,
      myCards,
      getCard,
      cardsForVendor,
      entriesFor,
      sessionsLeft,
      valueLeft,
      canRedeem,
      redeemSession,
      redeemValue,
    }),
    [
      ready,
      state.cards,
      state.entries,
      myCards,
      getCard,
      cardsForVendor,
      entriesFor,
      sessionsLeft,
      valueLeft,
      canRedeem,
      redeemSession,
      redeemValue,
    ],
  );

  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>;
}

export function useCards(): CardsContextValue {
  const value = useContext(CardsContext);
  if (!value) throw new Error('useCards must be used inside CardProvider');
  return value;
}
