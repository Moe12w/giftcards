// src/lib/data.ts
// Read/write helpers for the customer app. When Supabase is configured these
// query the real database through RLS-protected tables. Before credentials are
// added, they fall back to demo data so the UI can be built and tested.
import { hasSupabaseConfig } from './env';
import { MOCK_CARDS, MOCK_OFFERS, MOCK_ORDERS } from './mock-data';
import { getSupabase } from './supabase';
import type { GiftCard, Offer, Order } from './types';

export interface OfferWithBalance extends Offer {}

/** The database stores a category id; the app filters by its slug. */
function withCategorySlug(offer: Offer & { category?: { slug?: string } | null }): Offer {
  const slug = offer.category?.slug;
  return { ...offer, category: slug } as Offer;
}

export async function listActiveOffers(): Promise<Offer[]> {
  if (!hasSupabaseConfig) {
    return MOCK_OFFERS.filter((o) => o.is_active);
  }
  const { data, error } = await getSupabase()
    .from('products')
    .select('*, vendor:vendors(id, name, name_ar, logo_url, banner_url), category:categories(slug)')
    .eq('is_active', true)
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Offer[]).map(withCategorySlug);
}

export async function getOffer(id: string): Promise<Offer | null> {
  if (!hasSupabaseConfig) {
    return MOCK_OFFERS.find((o) => o.id === id) ?? null;
  }
  const { data, error } = await getSupabase()
    .from('products')
    .select('*, vendor:vendors(id, name, name_ar, logo_url, banner_url), category:categories(slug)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  const offer = data as (Offer & { category?: { slug?: string } | null }) | null;
  return offer ? withCategorySlug(offer) : null;
}

export async function listMyCards(): Promise<GiftCard[]> {
  if (!hasSupabaseConfig) {
    return MOCK_CARDS;
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const cards = (data ?? []) as GiftCard[];
  if (cards.length === 0) return cards;

  // Balance is derived in the `card_balances` view, never stored on the row.
  const { data: balances, error: balanceError } = await supabase
    .from('card_balances')
    .select('card_id, balance_minor')
    .in(
      'card_id',
      cards.map((c) => c.id),
    );
  if (balanceError) throw balanceError;

  const byCard = new Map(
    (balances ?? []).map((b: { card_id: string; balance_minor: number }) => [
      b.card_id,
      Number(b.balance_minor),
    ]),
  );

  return cards.map((card) => ({
    ...card,
    balance_minor: byCard.get(card.id) ?? 0,
  }));
}

export async function getMyCard(id: string): Promise<GiftCard | null> {
  if (!hasSupabaseConfig) {
    return MOCK_CARDS.find((c) => c.id === id) ?? null;
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: balance, error: balanceError } = await supabase
    .from('card_balances')
    .select('balance_minor')
    .eq('card_id', id)
    .maybeSingle();
  if (balanceError) throw balanceError;

  return {
    ...(data as GiftCard),
    balance_minor: Number(balance?.balance_minor ?? 0),
  };
}

export async function listMyOrders(): Promise<Order[]> {
  if (!hasSupabaseConfig) {
    return MOCK_ORDERS;
  }
  const { data, error } = await getSupabase()
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}
