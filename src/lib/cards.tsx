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
  useRef,
  useState,
} from 'react';

import { hasSupabaseConfig } from './env';
import { getSupabase } from './supabase';
import { useAuth } from './auth';
import {
  closeEnterpriseCode,
  listMyVouchers,
  listRedemptionsFor,
  redeemSessionOnServer,
  redeemValueOnServer,
  revealEnterpriseCode,
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
  /** Reads the partner's own code for a partner gift. */
  revealPartnerCode: (cardId: string) => Promise<string | null>;
  /** Marks a partner gift as used in the partner's app. */
  markPartnerCodeUsed: (cardId: string) => Promise<boolean>;
  /** Re-reads the wallet from the database. */
  reload: () => Promise<void>;
}

const CardsContext = createContext<CardsContextValue | null>(null);

/** Stable empties so a signed-out render does not allocate new arrays. */
const NO_CARDS: GiftCard[] = [];
const NO_ENTRIES: RedemptionEntry[] = [];

export function CardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Demo builds have no account but still show the sample wallet.
  const scope = hasSupabaseConfig ? userId : 'demo';
  const [cards, setCards] = useState<GiftCard[]>(NO_CARDS);
  const [entries, setEntries] = useState<RedemptionEntry[]>(NO_ENTRIES);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const walletRef = useRef<{ scope: string; cards: GiftCard[] }>({ scope: '', cards: [] });

  // Data belongs to one account. When the account changes (or the user signs
  // out) the old wallet is hidden immediately instead of leaking through, and
  // the tab shows its skeleton until the new rows land.
  const hasWallet = scope !== null && loadedScope === scope;
  const ready = !scope || hasWallet;
  const visibleCards = hasWallet ? cards : NO_CARDS;
  const visibleEntries = hasWallet ? entries : NO_ENTRIES;

  const load = useCallback(async (requestedUserId: string | null) => {
    const target = hasSupabaseConfig ? requestedUserId : 'demo';
    if (!target) return;
    try {
      // On a refresh we already know the voucher ids, so both reads can run
      // together. On the first load the history needs the ids, but the wallet
      // is painted as soon as the vouchers arrive — the history streams in
      // behind it and the stored balances already cover the wait.
      const previousIds =
        walletRef.current.scope === target
          ? walletRef.current.cards.map((card) => card.id)
          : [];
      const history = previousIds.length
        ? listRedemptionsFor(previousIds).catch(() => null)
        : null;

      const rows = await listMyVouchers();
      walletRef.current = { scope: target, cards: rows };
      setCards(rows);
      setLoadedScope(target);

      if (history) {
        const entries = await history;
        if (entries) setEntries(entries);
      } else {
        setEntries(await listRedemptionsFor(rows.map((row) => row.id)));
      }
    } catch {
      walletRef.current = { scope: target, cards: [] };
      setCards(NO_CARDS);
      setEntries(NO_ENTRIES);
    } finally {
      setLoadedScope(target);
    }
  }, []);

  useEffect(() => {
    void load(userId);
  }, [load, userId]);

  // A redemption on the web dashboard changes the voucher row. Realtime pushes
  // that change to the phone so the balance updates while the app is open.
  useEffect(() => {
    if (!hasSupabaseConfig || !userId) return;
    const supabase = getSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void load(userId);
      }, 250);
    };
    const channel = supabase
      .channel(`wallet:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vouchers', filter: `buyer_id=eq.${userId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vouchers', filter: `claimed_by=eq.${userId}` },
        refresh,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [load, userId]);

  const reload = useCallback(() => load(userId), [load, userId]);

  const getCard = useCallback(
    (id: string) => visibleCards.find((card) => card.id === id) ?? null,
    [visibleCards],
  );

  const entriesFor = useCallback(
    (cardId: string) => visibleEntries.filter((entry) => entry.card_id === cardId),
    [visibleEntries],
  );

  const cardsForVendor = useCallback(
    (vendorId: string) => visibleCards.filter((card) => card.vendor_id === vendorId),
    [visibleCards],
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
      await load(userId);
      return true;
    },
    [load, userId],
  );

  const redeemValue = useCallback(
    async (cardId: string, amountMinor: number, _actor: string) => {
      try {
        await redeemValueOnServer(cardId, amountMinor);
      } catch {
        return false;
      }
      await load(userId);
      return true;
    },
    [load, userId],
  );

  const revealPartnerCode = useCallback(async (cardId: string) => {
    try {
      return await revealEnterpriseCode(cardId);
    } catch {
      return null;
    }
  }, []);

  const markPartnerCodeUsed = useCallback(
    async (cardId: string) => {
      try {
        const result = await closeEnterpriseCode(cardId);
        if (!result.ok) return false;
      } catch {
        return false;
      }
      await load(userId);
      return true;
    },
    [load, userId],
  );

  // A voucher the customer received was claimed by them. A voucher they sent
  // was bought by them for somebody else.
  const receivedCards = useMemo(
    () => visibleCards.filter((card) => Boolean(userId) && card.claimed_by === userId),
    [visibleCards, userId],
  );

  const sentCards = useMemo(
    () =>
      visibleCards.filter(
        (card) => Boolean(userId) && card.buyer_id === userId && card.claimed_by !== userId,
      ),
    [visibleCards, userId],
  );

  const usableCards = useMemo(
    () =>
      visibleCards.filter(
        (card) =>
          card.status !== 'redeemed' &&
          card.status !== 'expired' &&
          card.status !== 'voided',
      ),
    [visibleCards],
  );

  const value = useMemo<CardsContextValue>(
    () => ({
      ready,
      cards: visibleCards,
      entries: visibleEntries,
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
      revealPartnerCode,
      markPartnerCodeUsed,
      reload,
    }),
    [
      ready,
      visibleCards,
      visibleEntries,
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
      revealPartnerCode,
      markPartnerCodeUsed,
      reload,
    ],
  );

  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>;
}

export function useCards(): CardsContextValue {
  const value = useContext(CardsContext);
  if (!value) throw new Error('useCards must be used inside CardProvider');
  return value;
}
