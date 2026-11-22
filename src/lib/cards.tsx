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

import { demoMode, hasSupabaseConfig } from './env';
import { getSupabase } from './supabase';
import { useAuth } from './auth';
import {
  closeEnterpriseCode,
  listMyVouchers,
  listRedemptionsFor,
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
  ownerId: string | null;
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
  const scope = demoMode ? 'demo' : userId;
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
    const target = demoMode ? 'demo' : requestedUserId;
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

  // The first wallet read runs here so nothing is written synchronously in the
  // effect body; load() still handles refreshes and every redemption.
  useEffect(() => {
    if (!demoMode && !userId) return undefined;
    const target = demoMode ? 'demo' : userId;
    if (!target) return undefined;
    let active = true;
    (async () => {
      try {
        const previousIds =
          walletRef.current.scope === target
            ? walletRef.current.cards.map((card) => card.id)
            : [];
        const history = previousIds.length
          ? listRedemptionsFor(previousIds).catch(() => null)
          : null;

        const rows = await listMyVouchers();
        if (!active) return;
        walletRef.current = { scope: target, cards: rows };
        setCards(rows);
        setLoadedScope(target);

        if (history) {
          const entries = await history;
          if (entries && active) setEntries(entries);
        } else {
          const entries = await listRedemptionsFor(rows.map((row) => row.id));
          if (active) setEntries(entries);
        }
      } catch {
        if (!active) return;
        walletRef.current = { scope: target, cards: [] };
        setCards(NO_CARDS);
        setEntries(NO_ENTRIES);
      } finally {
        if (active) setLoadedScope(target);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

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
      // A card bought for somebody else is never spendable by the buyer.
      if (userId && card.buyer_id === userId && card.claimed_by !== userId) return false;
      if (isSessionCard(card)) return canRedeemSession(card, entriesFor(card.id));
      return (
        card.status !== 'redeemed' &&
        card.status !== 'expired' &&
        card.status !== 'voided' &&
        valueRemaining(card, entriesFor(card.id)) > 0
      );
    },
    [entriesFor, userId],
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
  // was bought by them for somebody else. In the offline demo every card is
  // treated as received.
  const receivedCards = useMemo(
    () => visibleCards.filter((card) => !userId || card.claimed_by === userId),
    [visibleCards, userId],
  );

  const sentCards = useMemo(
    () =>
      visibleCards.filter(
        (card) => Boolean(userId) && card.buyer_id === userId && card.claimed_by !== userId,
      ),
    [visibleCards, userId],
  );

  // Only cards the customer actually owns can be spent. Sent cards stay in
  // the list for history, but never become "to use" or show a redeem code.
  const usableCards = useMemo(
    () =>
      receivedCards.filter(
        (card) =>
          card.status !== 'redeemed' &&
          card.status !== 'expired' &&
          card.status !== 'voided',
      ),
    [receivedCards],
  );

  const value = useMemo<CardsContextValue>(
    () => ({
      ready,
      ownerId: userId,
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
      revealPartnerCode,
      markPartnerCodeUsed,
      reload,
    }),
    [
      ready,
      userId,
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

/**
 * Opt-in realtime for wallet screens that need live balance/scan updates.
 * Keeping this off the global provider avoids one Supabase connection per user
 * for the whole app lifetime.
 */
export function useWalletRealtime() {
  const { ownerId, reload } = useCards();

  useEffect(() => {
    if (!hasSupabaseConfig || !ownerId) return;
    const supabase = getSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void reload(), 1000);
    };
    const channel = supabase
      .channel(`wallet:${ownerId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vouchers', filter: `buyer_id=eq.${ownerId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vouchers', filter: `claimed_by=eq.${ownerId}` },
        refresh,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [ownerId, reload]);
}
