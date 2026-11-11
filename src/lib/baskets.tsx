// src/lib/baskets.tsx
// Collaborative gift baskets.
//
// A basket, the cards inside it, who contributed and the activity feed all
// live in the database, so every participant sees the same box. Changes arrive
// over Supabase Realtime, which is why the feed updates live without a refresh.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from './auth';
import { getSupabase } from './supabase';
import { hasSupabaseConfig } from './env';
import type {
  BasketActivity,
  BasketItem,
  BasketParticipant,
  GiftBasket,
  OccasionId,
  Offer,
} from './types';

export interface BasketItemInput {
  offer: Offer;
  amountMinor: number;
}

export interface CreateBasketInput {
  name: string;
  recipientName: string;
  occasion: OccasionId;
  targetMinor?: number;
  items: BasketItemInput[];
  note?: string;
}

interface BasketContextValue {
  baskets: GiftBasket[];
  ready: boolean;
  activeBasket: GiftBasket | null;
  completedBaskets: GiftBasket[];
  getBasket: (id: string) => GiftBasket | null;
  getBasketByCode: (code: string) => GiftBasket | null;
  createBasket: (input: CreateBasketInput) => Promise<GiftBasket | null>;
  addItem: (basketId: string, input: BasketItemInput) => Promise<BasketItem | null>;
  removeItem: (basketId: string, itemId: string) => Promise<void>;
  joinBasket: (code: string) => Promise<GiftBasket | null>;
  markReady: (basketId: string) => Promise<void>;
  markCompleted: (basketId: string) => Promise<void>;
  sendBasket: (
    basketId: string,
    details: { recipientName?: string; message?: string },
  ) => Promise<void>;
  /** Re-reads the baskets from the database. */
  reload: () => Promise<void>;
}

const BasketContext = createContext<BasketContextValue | null>(null);

/** The basket row as it is stored, with its children. */
interface BasketRow {
  id: string;
  code: string;
  name: string;
  recipient_name: string;
  occasion: string;
  creator_id: string;
  creator_name: string;
  target_minor: number;
  status: 'open' | 'ready' | 'completed';
  note: string | null;
  created_at: string;
  completed_at: string | null;
  items?: BasketItemRow[] | null;
  participants?: ParticipantRow[] | null;
  activity?: ActivityRow[] | null;
}

interface BasketItemRow {
  id: string;
  offer_id: string;
  vendor_id: string;
  vendor_name: string;
  title: string;
  amount_minor: number;
  emoji: string | null;
  tone: string | null;
  logo_url: string | null;
  banner_url: string | null;
  added_by: string;
  added_by_name: string;
  added_at: string;
}

interface ParticipantRow {
  user_id: string;
  name: string;
  is_owner: boolean;
  tone: string;
  joined_at: string;
}

interface ActivityRow {
  id: string;
  kind: 'created' | 'joined' | 'item_added' | 'ready' | 'completed';
  actor_name: string;
  item_title: string | null;
  amount_minor: number | null;
  created_at: string;
}

function mapBasket(row: BasketRow): GiftBasket {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    recipient_name: row.recipient_name,
    occasion: row.occasion as OccasionId,
    creator_id: row.creator_id,
    creator_name: row.creator_name,
    target_minor: row.target_minor,
    status: row.status,
    items: (row.items ?? []).map(
      (item): BasketItem => ({
        id: item.id,
        offer_id: item.offer_id,
        vendor_id: item.vendor_id,
        vendor_name: item.vendor_name,
        title: item.title,
        amount_minor: item.amount_minor,
        icon: item.emoji ?? 'gift',
        tone: (item.tone as BasketItem['tone']) ?? 'lavender',
        logo_url: item.logo_url,
        banner_url: item.banner_url,
        added_by_id: item.added_by,
        added_by_name: item.added_by_name,
        added_at: item.added_at,
      }),
    ),
    participants: (row.participants ?? []).map(
      (participant): BasketParticipant => ({
        id: participant.user_id,
        name: participant.name,
        is_owner: participant.is_owner,
        joined_at: participant.joined_at,
        tone: (participant.tone as BasketParticipant['tone']) ?? 'teal',
      }),
    ),
    activity: (row.activity ?? []).map(
      (entry): BasketActivity => ({
        id: entry.id,
        kind: entry.kind,
        actor_name: entry.actor_name,
        item_title: entry.item_title ?? undefined,
        amount_minor: entry.amount_minor ?? undefined,
        created_at: entry.created_at,
      }),
    ),
    created_at: row.created_at,
    completed_at: row.completed_at ?? undefined,
    note: row.note ?? undefined,
  };
}

const BASKET_SELECT = `
  id, code, name, recipient_name, occasion, creator_id, creator_name, target_minor,
  status, note, created_at, completed_at,
  items:gift_basket_items(
    id, offer_id, vendor_id, vendor_name, title, amount_minor, emoji, tone,
    logo_url, banner_url, added_by, added_by_name, added_at
  ),
  participants:gift_basket_participants(user_id, name, is_owner, tone, joined_at),
  activity:gift_basket_activity(id, kind, actor_name, item_title, amount_minor, created_at)
`;

export function basketTotal(basket: GiftBasket): number {
  return basket.items.reduce((sum, item) => sum + item.amount_minor, 0);
}

export function participantTotals(basket: GiftBasket): Record<string, number> {
  return basket.items.reduce<Record<string, number>>((totals, item) => {
    totals[item.added_by_id] = (totals[item.added_by_id] ?? 0) + item.amount_minor;
    return totals;
  }, {});
}

export function basketProgress(basket: GiftBasket): number {
  if (!basket.target_minor) return 0;
  return Math.min(100, Math.round((basketTotal(basket) / basket.target_minor) * 100));
}

/** A code that looks like GIFT-XXXXX. */
function makeCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [baskets, setBaskets] = useState<GiftBasket[]>([]);
  const [ready, setReady] = useState(false);

  const displayName = useCallback(
    () =>
      (user?.user_metadata?.full_name as string | undefined) ??
      user?.email?.split('@')[0] ??
      'You',
    [user],
  );

  const load = useCallback(async () => {
    if (!hasSupabaseConfig) {
      setReady(true);
      return;
    }
    try {
      const { data, error } = await getSupabase()
        .from('gift_baskets')
        .select(BASKET_SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBaskets(((data ?? []) as unknown as BasketRow[]).map(mapBasket));
    } catch {
      setBaskets([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: every participant sees the same box.
  useEffect(() => {
    if (!hasSupabaseConfig) return;
    const channel = getSupabase()
      .channel('gift-baskets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gift_basket_items' },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gift_basket_participants' },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gift_basket_activity' },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gift_baskets' },
        () => load(),
      )
      .subscribe();
    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [load]);

  const getBasket = useCallback(
    (id: string) => baskets.find((basket) => basket.id === id) ?? null,
    [baskets],
  );

  const getBasketByCode = useCallback(
    (code: string) =>
      baskets.find((basket) => basket.code.toUpperCase() === code.trim().toUpperCase()) ?? null,
    [baskets],
  );

  const fetchBasket = useCallback(async (id: string): Promise<GiftBasket | null> => {
    const { data } = await getSupabase()
      .from('gift_baskets')
      .select(BASKET_SELECT)
      .eq('id', id)
      .maybeSingle();
    return data ? mapBasket(data as unknown as BasketRow) : null;
  }, []);

  const createBasket = useCallback(
    async (input: CreateBasketInput): Promise<GiftBasket | null> => {
      if (!hasSupabaseConfig || !user) return null;
      const ownerId = user.id;
      const ownerName = displayName();

      let code = makeCode();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data: clash } = await getSupabase()
          .from('gift_baskets')
          .select('id')
          .eq('code', `GIFT-${code}`)
          .maybeSingle();
        if (!clash) break;
        code = makeCode();
      }

      const { data: basket, error } = await getSupabase()
        .from('gift_baskets')
        .insert({
          code: `GIFT-${code}`,
          name: input.name.trim() || input.recipientName.trim() || 'Group gift',
          recipient_name: input.recipientName.trim(),
          occasion: input.occasion,
          creator_id: ownerId,
          creator_name: ownerName,
          target_minor: input.targetMinor ?? 0,
          note: input.note ?? null,
        })
        .select('id')
        .single();
      if (error || !basket) return null;

      for (const item of input.items) {
        await getSupabase().from('gift_basket_items').insert({
          basket_id: basket.id,
          offer_id: item.offer.id,
          vendor_id: item.offer.vendor_id,
          vendor_name: item.offer.vendor?.name ?? item.offer.title,
          title: item.offer.title,
          amount_minor: item.amountMinor,
          emoji: item.offer.icon ?? 'gift',
          tone: item.offer.tone ?? 'lavender',
          logo_url: item.offer.vendor?.logo_url ?? null,
          banner_url: item.offer.vendor?.banner_url ?? null,
          added_by: ownerId,
          added_by_name: ownerName,
        });
      }

      await getSupabase().from('gift_basket_activity').insert({
        basket_id: basket.id,
        kind: 'created',
        actor_id: ownerId,
        actor_name: ownerName,
      });

      await load();
      return fetchBasket(basket.id);
    },
    [displayName, fetchBasket, load, user],
  );

  const addItem = useCallback(
    async (basketId: string, input: BasketItemInput): Promise<BasketItem | null> => {
      if (!hasSupabaseConfig || !user) return null;
      const ownerName = displayName();

      const { data, error } = await getSupabase()
        .from('gift_basket_items')
        .insert({
          basket_id: basketId,
          offer_id: input.offer.id,
          vendor_id: input.offer.vendor_id,
          vendor_name: input.offer.vendor?.name ?? input.offer.title,
          title: input.offer.title,
          amount_minor: input.amountMinor,
          emoji: input.offer.icon ?? 'gift',
          tone: input.offer.tone ?? 'lavender',
          logo_url: input.offer.vendor?.logo_url ?? null,
          banner_url: input.offer.vendor?.banner_url ?? null,
          added_by: user.id,
          added_by_name: ownerName,
        })
        .select('id')
        .single();
      if (error || !data) return null;

      await getSupabase().from('gift_basket_activity').insert({
        basket_id: basketId,
        kind: 'item_added',
        actor_id: user.id,
        actor_name: ownerName,
        item_title: input.offer.title,
        amount_minor: input.amountMinor,
      });

      await load();

      return {
        id: data.id,
        offer_id: input.offer.id,
        vendor_id: input.offer.vendor_id,
        vendor_name: input.offer.vendor?.name ?? input.offer.title,
        title: input.offer.title,
        amount_minor: input.amountMinor,
        icon: input.offer.icon ?? 'gift',
        tone: input.offer.tone ?? 'lavender',
        added_by_id: user.id,
        added_by_name: ownerName,
        added_at: new Date().toISOString(),
      };
    },
    [displayName, load, user],
  );

  const removeItem = useCallback(
    async (basketId: string, itemId: string) => {
      if (!hasSupabaseConfig) return;
      await getSupabase()
        .from('gift_basket_items')
        .delete()
        .eq('basket_id', basketId)
        .eq('id', itemId);
      await load();
    },
    [load],
  );

  const joinBasket = useCallback(
    async (code: string): Promise<GiftBasket | null> => {
      if (!hasSupabaseConfig || !user) return null;
      const existing = baskets.find(
        (basket) => basket.code.toUpperCase() === code.trim().toUpperCase(),
      );
      if (existing) return existing;

      const { data, error } = await getSupabase().rpc('get_basket_by_code', {
        p_code: code.trim().toUpperCase(),
      });
      if (error || !data) return null;

      const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
      if (!row?.id) return null;

      await getSupabase().from('gift_basket_participants').insert({
        basket_id: row.id,
        user_id: user.id,
        name: displayName(),
        is_owner: false,
      });

      await getSupabase().from('gift_basket_activity').insert({
        basket_id: row.id,
        kind: 'joined',
        actor_id: user.id,
        actor_name: displayName(),
      });

      await load();
      return fetchBasket(row.id);
    },
    [baskets, displayName, fetchBasket, load, user],
  );

  const markReady = useCallback(
    async (basketId: string) => {
      if (!hasSupabaseConfig) return;
      await getSupabase().from('gift_baskets').update({ status: 'ready' }).eq('id', basketId);
      await load();
    },
    [load],
  );

  const markCompleted = useCallback(
    async (basketId: string) => {
      if (!hasSupabaseConfig) return;
      await getSupabase()
        .from('gift_baskets')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', basketId);
      await load();
    },
    [load],
  );

  const sendBasket = useCallback(
    async (basketId: string, details: { recipientName?: string; message?: string }) => {
      if (!hasSupabaseConfig) return;
      await getSupabase()
        .from('gift_baskets')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          recipient_name: details.recipientName?.trim() || undefined,
          note: details.message?.trim() || undefined,
        })
        .eq('id', basketId);
      await load();
    },
    [load],
  );

  const activeBasket = useMemo(() => {
    const open = baskets.find((basket) => basket.status === 'open');
    if (open) return open;
    return baskets.find((basket) => basket.status === 'ready') ?? null;
  }, [baskets]);

  const completedBaskets = useMemo(
    () => baskets.filter((basket) => basket.status === 'completed'),
    [baskets],
  );

  const value = useMemo<BasketContextValue>(
    () => ({
      baskets,
      ready,
      activeBasket,
      completedBaskets,
      getBasket,
      getBasketByCode,
      createBasket,
      addItem,
      removeItem,
      joinBasket,
      markReady,
      markCompleted,
      sendBasket,
      reload: load,
    }),
    [
      baskets,
      ready,
      activeBasket,
      completedBaskets,
      getBasket,
      getBasketByCode,
      createBasket,
      addItem,
      removeItem,
      joinBasket,
      markReady,
      markCompleted,
      sendBasket,
      load,
    ],
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBaskets(): BasketContextValue {
  const value = useContext(BasketContext);
  if (!value) throw new Error('useBaskets must be used inside BasketProvider');
  return value;
}
