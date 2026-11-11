// src/lib/cards.tsx
// The gift card wallet.
//
// Every voucher, balance and session comes from the database. Money vouchers
// keep a balance, experience vouchers keep a number of sessions, and both are
// derived from the same append-only ledger, so the customer's wallet and the
// vendor's dashboard always agree.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { hasSupabaseConfig } from './env';
import { useAuth } from './auth';
import {
  listMyVouchers,
  listRedemptionsFor,
  redeemSessionOnServer,
  redeemValueOnServer,
} from './data';
import {
  canRedeemSession,
  isSessionCard,
  sessionsRemaining,
  valueRemaining,
} from './sessions';
import type { GiftCard, RedemptionEntry } from './types';

export interface CardsContextValue {
  ready: boolean;
  /** Every voucher the customer can see. */
  cards: GiftCard[];
  /** The redemption history for those vouchers. */
  entries: RedemptionEntry[];
  /** Vouchers the customer received and can use. */
  receivedCards: GiftCard[];
  /** Vouchers the customer bought for someone else. */
  sentCards: GiftCard[];
  /** Vouchers the customer can still use. */
  usableCards: GiftCard[];
  getCard: (id: string) => GiftCard | null;
  cardsForVendor: (vendorId: string) => GiftCard[];
  entriesFor: (cardId: string) => RedemptionEntry[];
  sessionsLeft: (card: GiftCard) => number;
  valueLeft: (card: GiftCard) => number;
  canRedeem: (card: GiftCard) => boolean;
  /** Uses one session on an experience voucher. */
  redeemSession: (cardId: string, actor: string, note?: string) => Promise<boolean>;
  /** Spends an amount on a monetary voucher. */
  redeemValue: (cardId: string, amountMinor: number, actor: string) => Promise<boolean>;
  /** Re-reads the wallet from the database. */
  reload: () => Promise<void>;
}

const CardsContext = createContext<CardsContextValue | null>(null);

export function CardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [entries, setEntries] = useState<RedemptionEntry[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!hasSupabaseConfig) {
      setReady(true);
      return;
    }
    try {
      const rows = await listMyVouchers();
      setCards(rows);
      setEntries(await listRedemptionsFor(rows.map((row) => row.id)));
    } catch {
      setCards([]);
      setEntries([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getCard = useCallback(
    (id: string) => cards.find((card) => card.id === id) ?? null,
    [cards],
  );

  const entriesFor = useCallback(
    (cardId: string) => entries.filter((entry) => entry.card_id === cardId),
    [entries],
  );

  const cardsForVendor = useCallback(
    (vendorId: string) => cards.filter((card) => card.vendor_id === vendorId),
    [cards],
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
    async (cardId: string, _actor: string, note?: string) => {
      try {
        await redeemSessionOnServer(cardId, 1, note);
      } catch {
        return false;
      }
      await load();
      return true;
    },
    [load],
  );

  const redeemValue = useCallback(
    async (cardId: string, amountMinor: number, _actor: string) => {
      try {
        await redeemValueOnServer(cardId, amountMinor);
      } catch {
        return false;
      }
      await load();
      return true;
    },
    [load],
  );

  // A voucher the customer received was claimed by them. A voucher they sent
  // was bought by them for somebody else.
  const receivedCards = useMemo(
    () => cards.filter((card) => Boolean(userId) && card.claimed_by === userId),
    [cards, userId],
  );

  const sentCards = useMemo(
    () =>
      cards.filter(
        (card) => Boolean(userId) && card.buyer_id === userId && card.claimed_by !== userId,
      ),
    [cards, userId],
  );

  const usableCards = useMemo(
    () =>
      cards.filter(
        (card) =>
          card.status !== 'redeemed' &&
          card.status !== 'expired' &&
          card.status !== 'voided',
      ),
    [cards],
  );

  const value = useMemo<CardsContextValue>(
    () => ({
      ready,
      cards,
      entries,
      receivedCards,
      sentCards,
      usableCards,
      getCard,
      cardsForVendor,
      entriesFor,
      sessionsLeft,
      valueLeft,
      canRedeem,
      redeemSession,
      redeemValue,
      reload: load,
    }),
    [
      ready,
      cards,
      entries,
      receivedCards,
      sentCards,
      usableCards,
      getCard,
      cardsForVendor,
      entriesFor,
      sessionsLeft,
      valueLeft,
      canRedeem,
      redeemSession,
      redeemValue,
      load,
    ],
  );

  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>;
}

export function useCards(): CardsContextValue {
  const value = useContext(CardsContext);
  if (!value) throw new Error('useCards must be used inside CardProvider');
  return value;
}
