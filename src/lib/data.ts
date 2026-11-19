// src/lib/data.ts
// Read/write helpers for the customer app. When Supabase is configured these
// query the real database through RLS-protected tables. Before credentials are
// added, they fall back to demo data so the UI can be built and tested.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { cached, peekCache, primeCache } from './cache';
import { CATEGORIES, type CatalogEntry } from './catalog';
import { hasSupabaseConfig } from './env';
import {
  MOCK_CARDS,
  MOCK_LOCATIONS,
  MOCK_NOTIFICATIONS,
  MOCK_OFFERS,
  MOCK_ORDERS,
  MOCK_PAYMENT_METHODS,
  MOCK_REDEMPTIONS,
  MOCK_RECIPIENTS,
} from './mock-data';
import { getSupabase } from './supabase';
import { resolveTone } from './tone';
import type {
  CustomerAddress,
  CustomerPreferences,
  SupportRequest,
  AppNotification,
  BusinessLocation,
  CardStatus,
  GiftCard,
  MarketplaceBusiness,
  NotificationKind,
  Offer,
  Order,
  PaymentMethod,
  ProductVariant,
  Recipient,
  RedemptionEntry,
  SponsoredAd,
  SponsoredPlacement,
} from './types';

/** A ledger row as it is stored in the database. */
interface LedgerEntryRow {
  id: string;
  voucher_id: string;
  entry_type: string;
  amount_minor: number;
  sessions: number;
  created_at: string;
}

/** The notification row as it is stored in the database. */
interface NotificationRow {
  id: string;
  kind: string;
  title_key: string;
  body_key: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

/** A voucher row with the product and vendor it belongs to. */
interface VoucherProduct {
  title: string | null;
  icon: string | null;
  tone: string | null;
  image_url: string | null;
  partner?:
    | { name: string | null; logo_url: string | null }
    | { name: string | null; logo_url: string | null }[]
    | null;
}

export interface VoucherRow {
  id: string;
  voucher_code: string | null;
  qr_payload: string | null;
  product_id: string | null;
  vendor_id: string | null;
  buyer_id: string | null;
  claimed_by: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  fulfilment_type: string;
  status: string;
  initial_value_minor: number;
  remaining_value_minor: number | null;
  total_sessions: number | null;
  remaining_sessions: number | null;
  used_sessions: number | null;
  currency: string;
  delivery_status: string | null;
  scheduled_for: string | null;
  gift_message: string | null;
  expires_at: string | null;
  created_at: string;
  product?: VoucherProduct | VoucherProduct[] | null;
  vendor?: { name: string | null; logo_url: string | null } | { name: string | null; logo_url: string | null }[] | null;
}

/** PostgREST returns an embedded relation as an object or as a one item array. */
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Maps a database voucher onto the shape the customer app renders. */
export function mapVoucher(row: VoucherRow): GiftCard {
  const product = firstRelation(row.product);
  const vendor = firstRelation(row.vendor);
  const partner = firstRelation(product?.partner);
  const status = ((): CardStatus => {
    switch (row.status) {
      case 'issued':
        return 'issued';
      case 'redeemed':
        return 'redeemed';
      case 'expired':
        return 'expired';
      case 'cancelled':
      case 'void':
        return 'voided';
      default:
        return 'claimed';
    }
  })();

  return {
    id: row.id,
    offer_id: row.product_id ?? '',
    order_id: null,
    buyer_id: row.buyer_id,
    recipient_name: row.recipient_name,
    recipient_email: row.recipient_email,
    original_value_minor: row.initial_value_minor,
    balance_minor: row.remaining_value_minor ?? 0,
    status,
    claim_token_hash: null,
    claimed_by: row.claimed_by,
    claimed_at: null,
    expires_at: row.expires_at,
    created_at: row.created_at,
    vendor_id: row.vendor_id ?? undefined,
    vendor_name: vendor?.name ?? undefined,
    partner_name: partner?.name ?? undefined,
    offer_title: product?.title ?? undefined,
    icon: product?.icon ?? 'gift',
    image_url: product?.image_url ?? undefined,
    tone: resolveTone(product?.tone),
    delivery_status: (row.delivery_status as GiftCard['delivery_status']) ?? undefined,
    scheduled_for: row.scheduled_for,
    message: row.gift_message,
    fulfilment_type: row.fulfilment_type as GiftCard['fulfilment_type'],
    total_sessions: row.total_sessions ?? undefined,
    remaining_sessions: row.remaining_sessions ?? undefined,
  };
}

/**
 * Rows to ask for. Screens pass `offset` to fetch the next page, so the server
 * does the skipping and a large history never lands in one response.
 */
export interface PageOptions {
  limit?: number;
  offset?: number;
}

/**
 * Default page sizes. They sit well above what a normal customer accumulates
 * today, so list screens keep showing a full history, while a runaway one
 * (thousands of orders or notifications) is bounded to a single page.
 */
export const PAGE_SIZE = {
  vouchers: 100,
  redemptions: 200,
  orders: 50,
  notifications: 50,
  support: 50,
  favourites: 50,
  catalog: 200,
  businesses: 100,
} as const;

/** No single response should ever grow past this, whatever a caller asks for. */
const MAX_PAGE_SIZE = 500;

/** Turns page options into a PostgREST range, whose `to` is inclusive. */
function pageWindow(options: PageOptions | undefined, fallback: number) {
  const requested = Math.trunc(options?.limit ?? fallback);
  const limit = Math.min(
    Math.max(Number.isFinite(requested) ? requested : fallback, 1),
    MAX_PAGE_SIZE,
  );
  const requestedOffset = Math.trunc(options?.offset ?? 0);
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
  return { limit, offset, from: offset, to: offset + limit - 1 };
}

/** Every voucher the signed in customer can see, newest first. */
export async function listMyVouchers(options?: PageOptions): Promise<GiftCard[]> {
  if (!hasSupabaseConfig) {
    return MOCK_CARDS;
  }
  const page = pageWindow(options, PAGE_SIZE.vouchers);
  const { data, error } = await getSupabase()
    .from('vouchers')
    .select(
      'id, voucher_code, qr_payload, product_id, vendor_id, buyer_id, claimed_by, recipient_name, recipient_email, fulfilment_type, status, initial_value_minor, remaining_value_minor, total_sessions, remaining_sessions, used_sessions, currency, delivery_status, scheduled_for, gift_message, expires_at, created_at, product:products(title, icon, tone, image_url, partner:enterprise_partners(name, logo_url)), vendor:vendors(name, logo_url)',
    )
    .order('created_at', { ascending: false })
    .range(page.from, page.to);
  if (error) throw error;
  return ((data ?? []) as unknown as VoucherRow[]).map(mapVoucher);
}

/** The redemption history for the given vouchers. */
export async function listRedemptionsFor(
  voucherIds: string[],
  options?: PageOptions,
): Promise<RedemptionEntry[]> {
  if (!hasSupabaseConfig) return MOCK_REDEMPTIONS;
  if (voucherIds.length === 0) return [];
  const page = pageWindow(options, PAGE_SIZE.redemptions);
  const { data, error } = await getSupabase()
    .from('ledger_entries')
    .select('id, voucher_id, entry_type, amount_minor, sessions, created_at')
    .in('voucher_id', voucherIds)
    .neq('entry_type', 'issue')
    .order('created_at', { ascending: false })
    .range(page.from, page.to);
  if (error) throw error;

  return ((data ?? []) as LedgerEntryRow[]).map((row) => ({
    id: row.id,
    card_id: row.voucher_id,
    kind: row.sessions ? 'session' : 'monetary',
    sessions: row.sessions ? Math.abs(row.sessions) : undefined,
    amount_minor: row.amount_minor ? Math.abs(row.amount_minor) : undefined,
    actor: 'Giftly',
    created_at: row.created_at,
  }));
}

/** Uses one session on an experience voucher, on the server. */
export async function redeemSessionOnServer(
  voucherId: string,
  sessions = 1,
  serviceLabel?: string,
): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase().rpc('redeem_sessions', {
    p_voucher_id: voucherId,
    p_sessions: sessions,
    p_notes: null,
    p_service_label: serviceLabel ?? null,
  });
  if (error) throw error;
}

/** Spends an amount on a monetary voucher, on the server. */
export async function redeemValueOnServer(voucherId: string, amountMinor: number): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase().rpc('redeem_monetary', {
    p_voucher_id: voucherId,
    p_amount_minor: amountMinor,
    p_notes: null,
  });
  if (error) throw error;
}

/** Saves the signed in customer's saved recipients. */
export async function listRecipients(): Promise<Recipient[]> {
  if (!hasSupabaseConfig) return MOCK_RECIPIENTS;
  const { data, error } = await getSupabase()
    .from('recipients')
    .select('id, name, email, phone, relation')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Recipient[];
}

/** Adds a saved recipient. */
export async function addRecipient(recipient: Omit<Recipient, 'id'>): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase().from('recipients').insert(recipient);
  if (error) throw error;
}

/** Removes a saved recipient. */
export async function removeRecipient(id: string): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase().from('recipients').delete().eq('id', id);
  if (error) throw error;
}

/** The saved payment methods of the signed in customer. */
export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  if (!hasSupabaseConfig) return MOCK_PAYMENT_METHODS;
  const { data, error } = await getSupabase()
    .from('payment_methods')
    .select('id, brand, last4, expiry, is_default')
    .order('is_default', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as {
    id: string;
    brand: string | null;
    last4: string | null;
    expiry: string | null;
    is_default: boolean;
  }[]).map((row) => ({
    id: row.id,
    brand: row.brand ?? 'Card',
    last4: row.last4 ?? '••••',
    expiry: row.expiry ?? '',
    isDefault: row.is_default,
  }));
}

/** The branches of a business. */
export async function listVendorLocations(vendorId: string): Promise<BusinessLocation[]> {
  if (!hasSupabaseConfig) {
    return MOCK_LOCATIONS.filter((location) => location.vendorId === vendorId);
  }
  return cached(`locations:${vendorId}`, 5 * 60_000, async () => {
    const { data, error } = await getSupabase()
      .from('vendor_locations')
      .select('id, area, address, hours')
      .eq('vendor_id', vendorId)
      .order('is_primary', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as { id: string; area: string | null; address: string | null; hours: string | null }[]).map(
      (row) => ({
        id: row.id,
        vendorId,
        area: row.area ?? '',
        address: row.address ?? '',
        hours: row.hours ?? '',
      }),
    );
  });
}

/** Business fields every catalog screen reads. Avoids `select *` on a view. */
const BUSINESS_COLUMNS =
  'id, business_kind, name, slug, logo_url, banner_url, city, area, rating, description, status, is_featured, gift_count';

/** Seeds the cache from a list the screen already has in hand. */
export function primeBusinesses(rows: MarketplaceBusiness[]): void {
  for (const business of rows) {
    primeCache(`business:${business.id}`, business);
    if (business.slug) primeCache(`business:${business.slug}`, business);
  }
  primeCache('businesses:all', rows);
}

/** The cached copy of a business, if this launch has seen it. */
export function peekBusiness(idOrSlug: string): MarketplaceBusiness | null {
  return peekCache<MarketplaceBusiness>(`business:${idOrSlug}`) ?? null;
}

/** The cached business directory, if this launch has seen it. */
export function peekBusinesses(): MarketplaceBusiness[] {
  return peekCache<MarketplaceBusiness[]>('businesses:all') ?? [];
}

/** Seeds every offer, plus the catalog, so a gift page opens instantly. */
export function primeOffers(rows: Offer[]): void {
  for (const offer of rows) primeCache(`offer:${offer.id}`, offer);
  primeCache('offers:active', rows);
}

/** The cached copy of an offer, if this launch has seen it. */
export function peekOffer(id: string): Offer | null {
  return peekCache<Offer>(`offer:${id}`) ?? null;
}

/** The cached active catalog, if this launch has seen it. */
export function peekOffers(): Offer[] {
  return peekCache<Offer[]>('offers:active') ?? [];
}

/** The cached locations for a vendor, if this launch has seen them. */
export function peekLocations(vendorId: string): BusinessLocation[] {
  return peekCache<BusinessLocation[]>(`locations:${vendorId}`) ?? [];
}

/** Offers already cached for one business, used to paint before the network. */
export function peekOffersForBusiness(businessId: string): Offer[] {
  const specific = peekCache<Offer[]>(`offers:business:${businessId}`);
  if (specific) return specific;
  const rows = peekCache<Offer[]>('offers:active') ?? [];
  return rows.filter((offer) => offerBusinessId(offer) === businessId);
}

function offerBusinessId(offer: Offer): string {
  return offer.partner?.id ?? offer.vendor_id ?? offer.partner_id ?? '';
}

/** Fetches one business (vendor or partner) by id or slug. */
export async function getBusiness(idOrSlug: string): Promise<MarketplaceBusiness | null> {
  if (!hasSupabaseConfig) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  return cached(`business:${idOrSlug}`, 5 * 60_000, async () => {
    let query = getSupabase().from('marketplace_businesses').select(BUSINESS_COLUMNS);
    query = isUuid ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    const business = (data ?? null) as MarketplaceBusiness | null;
    if (business) primeBusinesses([business]);
    return business;
  });
}

/** Kept for older callers: a partner is one kind of business. */
export async function getPartner(idOrSlug: string): Promise<MarketplaceBusiness | null> {
  const business = await getBusiness(idOrSlug);
  return business?.business_kind === 'partner' ? business : null;
}

/** The public business directory: vendors and partners combined. */
export async function listMarketplaceBusinesses(
  options?: PageOptions,
): Promise<MarketplaceBusiness[]> {
  if (!hasSupabaseConfig) return [];
  const page = pageWindow(options, PAGE_SIZE.businesses);
  // The first page keeps the existing key so the bootstrap cache and
  // peekBusinesses() still hit it; later pages get an entry of their own.
  const key =
    page.offset === 0 && page.limit === PAGE_SIZE.businesses
      ? 'businesses:all'
      : `businesses:all:${page.limit}:${page.offset}`;
  return cached(key, 60_000, async () => {
    const { data, error } = await getSupabase()
      .from('marketplace_businesses')
      .select(BUSINESS_COLUMNS)
      .order('gift_count', { ascending: false })
      .order('rating', { ascending: false })
      .range(page.from, page.to);
    if (error) throw error;
    const rows = (data ?? []) as MarketplaceBusiness[];
    primeBusinesses(rows);
    return rows;
  });
}

/** Fetches the businesses an admin chose for the home featured shelf, in order. */
export async function listBusinessesByIds(ids: string[]): Promise<MarketplaceBusiness[]> {
  if (!hasSupabaseConfig) return [];
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 24);
  if (unique.length === 0) return [];
  const key = `businesses:ids:${unique.join(',')}`;
  return cached(key, 60_000, async () => {
    const { data, error } = await getSupabase()
      .from('marketplace_businesses')
      .select(BUSINESS_COLUMNS)
      .in('id', unique);
    if (error) throw error;
    const byId = new Map(
      ((data ?? []) as MarketplaceBusiness[]).map((row) => [row.id, row]),
    );
    return unique
      .map((id) => byId.get(id))
      .filter((row): row is MarketplaceBusiness => Boolean(row));
  });
}

/** A category row plus the presentation metadata the app needs. */
export interface AppCategory extends CatalogEntry {
  /** Display name from the dashboard; empty falls back to the translated key. */
  name: string;
  nameAr: string | null;
  showOnHome: boolean;
  sortOrder: number;
}

interface CategoryRow {
  slug: string;
  name: string;
  name_ar: string | null;
  icon: string | null;
  sort_order: number;
  show_on_home: boolean;
  tone: string | null;
}

const CATEGORY_COLUMNS = 'slug, name, name_ar, icon, sort_order, show_on_home, tone';

function defaultAppCategories(): AppCategory[] {
  return CATEGORIES.map((entry, index) => ({
    ...entry,
    name: '',
    nameAr: null,
    showOnHome: true,
    sortOrder: index + 1,
  }));
}

/**
 * Active categories in the dashboard's order. The table is the source of
 * truth; the static catalog only supplies the translated title key and the
 * artwork fallback for the original nine slugs.
 */
export async function listAppCategories(): Promise<AppCategory[]> {
  return cached('categories:app', 60_000, async () => {
    if (!hasSupabaseConfig) return defaultAppCategories();
    const { data, error } = await getSupabase()
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as CategoryRow[];
    if (rows.length === 0) return defaultAppCategories();
    return rows.map((row) => {
      const known = CATEGORIES.find((entry) => entry.slug === row.slug);
      return {
        slug: row.slug,
        icon: row.icon || known?.icon || 'gift',
        tone: resolveTone(row.tone, known?.tone ?? 'lavender'),
        titleKey: known?.titleKey ?? '',
        name: row.name,
        nameAr: row.name_ar,
        showOnHome: row.show_on_home,
        sortOrder: row.sort_order,
      };
    });
  });
}

/** The cached category list, or the built-in nine before the first fetch. */
export function peekAppCategories(): AppCategory[] {
  return peekCache<AppCategory[]>('categories:app') ?? defaultAppCategories();
}

/** Dashboard name first, then the translated static label. */
export function categoryLabel(
  category: AppCategory,
  language: string,
  fallback = '',
): string {
  const localized =
    language === 'ar' ? category.nameAr || category.name : category.name;
  return localized || fallback || category.slug.replace(/-/g, ' ');
}

/** Public marketplace configuration (feature flags, copy, thresholds). */
export async function getPublicSettings(): Promise<Record<string, unknown>> {
  return cached('settings:public', 60 * 60_000, async () => {
    if (!hasSupabaseConfig) return {};
    const { data, error } = await getSupabase()
      .from('system_settings')
      .select('key, value')
      .eq('is_public', true);
    if (error) throw error;
    const settings: Record<string, unknown> = {};
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      settings[row.key] = row.value;
    }
    return settings;
  });
}

export async function listFavourites(options?: PageOptions): Promise<Offer[]> {
  if (!hasSupabaseConfig) return [];
  const page = pageWindow(options, PAGE_SIZE.favourites);
  const { data, error } = await getSupabase()
    .from('favourites')
    .select(
      'product_id, vendor_id, product:products(*, vendor:vendors(id, name, name_ar, logo_url, banner_url), partner:enterprise_partners(id, name, logo_url, banner_url), category:categories(slug), variants:product_variants(*)), vendor:vendors(*)',
    )
    .order('created_at', { ascending: false })
    .range(page.from, page.to);
  if (error) throw error;

  return ((data ?? []) as unknown[])
    .map((row) => {
      const entry = row as {
        product: (Offer & { vendor?: Offer['vendor'] }) | null;
        vendor: Offer['vendor'] | null;
      };
      if (entry.product) return mapOffer(entry.product as OfferRow);
      if (entry.vendor) {
        return {
          id: entry.vendor.id,
          vendor_id: entry.vendor.id,
          title: entry.vendor.name ?? '',
          description: null,
          image_url: null,
          min_amount_minor: 0,
          max_amount_minor: 0,
          preset_amounts_minor: [],
          valid_until: null,
          is_active: true,
          created_at: new Date().toISOString(),
          vendor: entry.vendor,
        };
      }
      return null;
    })
    .filter((offer): offer is Offer => Boolean(offer));
}

type OfferRow = Offer & {
  category?: { slug?: string } | { slug?: string }[] | null;
  variants?: ProductVariant[] | null;
};

/**
 * Normalises a product row: flattens the embedded category and keeps only the
 * vendor's active variants, in the order they chose.
 */
function mapOffer(row: OfferRow): Offer {
  const category = Array.isArray(row.category) ? row.category[0] : row.category;
  const variants = [...(row.variants ?? [])]
    .filter((variant) => variant.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.price_minor - b.price_minor);
  return { ...row, category: category?.slug, variants } as Offer;
}

export async function listActiveOffers(options?: PageOptions): Promise<Offer[]> {
  if (!hasSupabaseConfig) {
    return MOCK_OFFERS.filter((o) => o.is_active);
  }
  const page = pageWindow(options, PAGE_SIZE.catalog);
  // Keeps 'offers:active' as the key the bootstrap and peekOffers() read.
  const key =
    page.offset === 0 && page.limit === PAGE_SIZE.catalog
      ? 'offers:active'
      : `offers:active:${page.limit}:${page.offset}`;
  return cached(key, 60_000, async () => {
    const { data, error } = await getSupabase()
      .from('products')
      .select(
        '*, vendor:vendors(id, name, name_ar, logo_url, banner_url), partner:enterprise_partners(id, name, logo_url, banner_url), category:categories(slug), variants:product_variants(*)',
      )
      .eq('is_active', true)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range(page.from, page.to);
    if (error) throw error;
    const rows = ((data ?? []) as OfferRow[]).map(mapOffer);
    primeOffers(rows);
    return rows;
  });
}

/**
 * The offers belonging to one business. The home feed already holds the full
 * catalog, so use that copy when it exists; otherwise ask for just this
 * business instead of downloading every product on the marketplace.
 */
export async function listOffersForBusiness(businessId: string): Promise<Offer[]> {
  if (!hasSupabaseConfig) {
    return MOCK_OFFERS.filter((offer) => offer.is_active && offerBusinessId(offer) === businessId);
  }
  const fromCatalog = peekOffersForBusiness(businessId);
  if (fromCatalog.length > 0) return fromCatalog;

  return cached(`offers:business:${businessId}`, 60_000, async () => {
    const { data, error } = await getSupabase()
      .from('products')
      .select(
        '*, vendor:vendors(id, name, name_ar, logo_url, banner_url), partner:enterprise_partners(id, name, logo_url, banner_url), category:categories(slug), variants:product_variants(*)',
      )
      .eq('is_active', true)
      .eq('status', 'published')
      .or(`vendor_id.eq.${businessId},partner_id.eq.${businessId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = ((data ?? []) as OfferRow[]).map(mapOffer);
    primeOffers(rows);
    return rows;
  });
}

export async function getOffer(id: string): Promise<Offer | null> {
  if (!hasSupabaseConfig) {
    return MOCK_OFFERS.find((o) => o.id === id) ?? null;
  }
  return cached(`offer:${id}`, 5 * 60_000, async () => {
    const { data, error } = await getSupabase()
      .from('products')
      .select(
        '*, vendor:vendors(id, name, name_ar, logo_url, banner_url), partner:enterprise_partners(id, name, logo_url, banner_url), category:categories(slug), variants:product_variants(*)',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const offer = mapOffer(data as OfferRow);
    primeCache(`offer:${offer.id}`, offer);
    return offer;
  });
}

export async function listMyCards(): Promise<GiftCard[]> {
  // The cards tab and the wallet read the same rows. Reusing the voucher
  // mapping keeps partner and vendor names, logos and partner-code balances.
  return listMyVouchers();
}

export async function getMyCard(id: string): Promise<GiftCard | null> {
  if (!hasSupabaseConfig) {
    return MOCK_CARDS.find((c) => c.id === id) ?? null;
  }
  const { data, error } = await getSupabase()
    .from('vouchers')
    .select(
      'id, voucher_code, qr_payload, product_id, vendor_id, buyer_id, claimed_by, recipient_name, recipient_email, fulfilment_type, status, initial_value_minor, remaining_value_minor, total_sessions, remaining_sessions, used_sessions, currency, delivery_status, scheduled_for, gift_message, expires_at, created_at, product:products(title, icon, tone, image_url, partner:enterprise_partners(name, logo_url)), vendor:vendors(name, logo_url)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapVoucher(data as unknown as VoucherRow) : null;
}

export async function listMyOrders(options?: PageOptions): Promise<Order[]> {
  if (!hasSupabaseConfig) {
    return MOCK_ORDERS;
  }
  const page = pageWindow(options, PAGE_SIZE.orders);
  const { data, error } = await getSupabase()
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .range(page.from, page.to);
  if (error) throw error;

  // Catalogue orders (including MCP-prepared ones) carry their total on the
  // header. Older offer orders still carry amount_minor. Normalise both so the
  // list renders the same shape it always has.
  type OrderRow = Order & {
    amount_minor?: number | null;
    total_minor?: number | null;
    payment_reference?: string | null;
  };

  return ((data ?? []) as OrderRow[]).map((row) => {
    const total = Number(row.total_minor ?? 0);
    const amount =
      typeof row.amount_minor === 'number'
        ? row.amount_minor
        : Number.isFinite(total)
          ? total
          : 0;

    return {
      ...row,
      amount_minor: amount,
      payment_reference: row.payment_reference ?? row.order_ref ?? row.id,
    };
  });
}

/** How many orders the customer has, without downloading their rows. */
export async function countMyOrders(): Promise<number> {
  if (!hasSupabaseConfig) {
    return MOCK_ORDERS.length;
  }
  const { count, error } = await getSupabase()
    .from('orders')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Maps a notification row onto the shape a screen renders. */
function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    titleKey: row.title_key,
    bodyKey: row.body_key,
    created_at: row.created_at,
    read: Boolean(row.read_at),
    gift_id: (row.payload as { gift_id?: string } | null)?.gift_id,
    support_request_id: (row.payload as { support_request_id?: string } | null)
      ?.support_request_id,
  };
}

/**
 * The notification centre reads straight from the database, so "mark as read"
 * survives leaving the screen.
 */
export async function listNotifications(options?: PageOptions): Promise<AppNotification[]> {
  if (!hasSupabaseConfig) {
    return MOCK_NOTIFICATIONS;
  }
  const page = pageWindow(options, PAGE_SIZE.notifications);
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('id, kind, title_key, body_key, payload, read_at, created_at')
    .order('created_at', { ascending: false })
    .range(page.from, page.to);
  if (error) throw error;

  return ((data ?? []) as NotificationRow[]).map(mapNotification);
}

/** One notification by id, for a detail screen that only needs that row. */
export async function getNotification(id: string): Promise<AppNotification | null> {
  if (!hasSupabaseConfig) {
    return MOCK_NOTIFICATIONS.find((item) => item.id === id) ?? null;
  }
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('id, kind, title_key, body_key, payload, read_at, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapNotification(data as NotificationRow) : null;
}

/**
 * Mints a fresh claim link for a gift the customer bought, so it can be sent
 * again. Only the hash of a claim token is stored, so this is the only way back
 * to a link that can be put in a WhatsApp message.
 */
export async function buyerClaimLink(voucherId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('buyer_claim_link', {
    p_voucher_id: voucherId,
  });
  if (error) throw error;
  if (!data) throw new Error('No claim link was created.');
  return String(data);
}

/** Marks one notification as read. */
export async function markNotificationRead(id: string): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

/** Marks every unread notification as read. */
export async function markAllNotificationsRead(): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}

/** How many notifications are still unread. */
export async function countUnreadNotifications(): Promise<number> {
  if (!hasSupabaseConfig) {
    return MOCK_NOTIFICATIONS.filter((item) => !item.read).length;
  }
  const { count, error } = await getSupabase()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** The signed in customer's saved addresses. */
export async function listAddresses(): Promise<CustomerAddress[]> {
  if (!hasSupabaseConfig) return [];
  const { data, error } = await getSupabase()
    .from('customer_addresses')
    .select('id, label, line1, city, postcode, is_default')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as {
    id: string;
    label: string;
    line1: string;
    city: string;
    postcode: string | null;
    is_default: boolean;
  }[]).map((row) => ({
    id: row.id,
    label: row.label,
    line1: row.line1,
    city: row.city,
    postcode: row.postcode,
    isDefault: row.is_default,
  }));
}

/** Adds a saved address. */
export async function addAddress(address: Omit<CustomerAddress, 'id'>): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { isDefault, ...rest } = address;
  const { error } = await getSupabase().from('customer_addresses').insert({
    ...rest,
    is_default: isDefault,
  });
  if (error) throw error;
}

/** Removes a saved address. */
export async function removeAddress(id: string): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase().from('customer_addresses').delete().eq('id', id);
  if (error) throw error;
}

/** The signed in customer's preferences. */
export async function getPreferences(): Promise<CustomerPreferences> {
  const fallback: CustomerPreferences = {
    dark_mode: false,
    biometrics: false,
    privacy_analytics: true,
    privacy_personalised: true,
    gift_updates: true,
    promotions: false,
    expiry_reminders: true,
    email: true,
    push: true,
    sms: false,
  };
  if (!hasSupabaseConfig) return fallback;

  const [settings, notifications] = await Promise.all([
    getSupabase()
      .from('customer_preferences')
      .select('dark_mode, biometrics, privacy_analytics, privacy_personalised')
      .maybeSingle(),
    getSupabase()
      .from('notification_preferences')
      .select('gift_updates, promotions, expiry_reminders, email, push, sms')
      .maybeSingle(),
  ]);

  return {
    ...fallback,
    ...(settings.data ?? {}),
    ...(notifications.data ?? {}),
  };
}

/** Saves the signed in customer's preferences. */
export async function savePreferences(preferences: Partial<CustomerPreferences>): Promise<void> {
  if (!hasSupabaseConfig) return;

  const settings = {
    dark_mode: preferences.dark_mode,
    biometrics: preferences.biometrics,
    privacy_analytics: preferences.privacy_analytics,
    privacy_personalised: preferences.privacy_personalised,
  };
  const notifications = {
    gift_updates: preferences.gift_updates,
    promotions: preferences.promotions,
    expiry_reminders: preferences.expiry_reminders,
    email: preferences.email,
    push: preferences.push,
    sms: preferences.sms,
  };

  const hasSettings = Object.values(settings).some((value) => value !== undefined);
  const hasNotifications = Object.values(notifications).some((value) => value !== undefined);

  if (hasSettings) {
    const { error } = await getSupabase()
      .from('customer_preferences')
      .upsert(settings, { onConflict: 'user_id' });
    if (error) throw error;
  }
  if (hasNotifications) {
    const { error } = await getSupabase()
      .from('notification_preferences')
      .upsert(notifications, { onConflict: 'user_id' });
    if (error) throw error;
  }
}

/** Sends a support request to the platform. */
export async function createSupportRequest(input: {
  kind: 'contact' | 'report' | 'report_gift' | 'refund' | 'chat';
  subject?: string | null;
  body: string;
  reference?: string | null;
}): Promise<void> {
  if (!hasSupabaseConfig) return;
  const {
    data: { user },
  } = await getSupabase().auth.getUser();
  const { error } = await getSupabase().from('support_requests').insert({
    ...input,
    // Without this, RLS hides the ticket from the person who sent it and only
    // admins can see it.
    customer_id: user?.id ?? null,
    requester_kind: user ? 'customer' : 'visitor',
  });
  if (error) throw error;
}

/** The support requests the customer sent. */
export async function listSupportRequests(options?: PageOptions): Promise<SupportRequest[]> {
  if (!hasSupabaseConfig) return [];
  const {
    data: { user },
  } = await getSupabase().auth.getUser();
  if (!user) return [];
  const page = pageWindow(options, PAGE_SIZE.support);
  const { data, error } = await getSupabase()
    .from('support_requests')
    .select('id, kind, subject, body, reference, status, created_at')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .range(page.from, page.to);
  if (error) throw error;
  return (data ?? []) as SupportRequest[];
}

/** One support request, scoped by RLS to the signed-in customer. */
export async function getSupportRequest(id: string): Promise<SupportRequest | null> {
  if (!hasSupabaseConfig) return null;
  const {
    data: { user },
  } = await getSupabase().auth.getUser();
  if (!user) return null;
  const { data, error } = await getSupabase()
    .from('support_requests')
    .select('id, kind, subject, body, reference, status, created_at')
    .eq('id', id)
    .eq('customer_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as SupportRequest | null) ?? null;
}

/** A reply on a support ticket, from the customer or from the team. */
export interface SupportMessage {
  id: string;
  request_id: string;
  author_role: 'requester' | 'admin';
  author_name: string;
  body: string;
  created_at: string;
}

/** The full conversation on one of the customer's own tickets. */
export async function listSupportMessages(requestId: string): Promise<SupportMessage[]> {
  if (!hasSupabaseConfig) return [];
  const {
    data: { user },
  } = await getSupabase().auth.getUser();
  if (!user) return [];
  // Explicit ownership check so an admin account cannot read every thread
  // through the customer app just because RLS grants admins global access.
  const { data: ticket } = await getSupabase()
    .from('support_requests')
    .select('id')
    .eq('id', requestId)
    .eq('customer_id', user.id)
    .maybeSingle();
  if (!ticket) return [];
  const { data, error } = await getSupabase()
    .from('support_ticket_messages')
    .select('id, request_id, author_role, author_name, body, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupportMessage[];
}

/** Adds the customer's reply to one of their own tickets. */
export async function replyToSupportRequest(requestId: string, body: string): Promise<void> {
  if (!hasSupabaseConfig) return;
  const {
    data: { user },
  } = await getSupabase().auth.getUser();
  if (!user) throw new Error('Sign in to reply.');
  const { data: ticket } = await getSupabase()
    .from('support_requests')
    .select('id')
    .eq('id', requestId)
    .eq('customer_id', user.id)
    .maybeSingle();
  if (!ticket) throw new Error('That request is not available for this account.');
  const authorName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'Requester';
  const { error } = await getSupabase().from('support_ticket_messages').insert({
    request_id: requestId,
    author_id: user?.id ?? null,
    author_role: 'requester',
    author_name: authorName,
    body,
  });
  if (error) throw error;
}

/** Checks a promo code and returns the discount it gives. */
export async function validatePromoCode(
  code: string,
  subtotalMinor: number,
): Promise<{ discountMinor: number; message: string }> {
  if (!hasSupabaseConfig) return { discountMinor: 0, message: 'promoInvalid' };
  const { data, error } = await getSupabase().rpc('validate_promo_code', {
    p_code: code.trim(),
    p_subtotal_minor: subtotalMinor,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { discount_minor: number; message: string }
    | null;
  return {
    discountMinor: row?.discount_minor ?? 0,
    message: row?.message ?? 'promoInvalid',
  };
}

/** Saves a payment method. Only the reference is stored, never the number. */
export async function addPaymentMethod(method: {
  brand: string;
  last4: string;
  expiry: string;
}): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase().from('payment_methods').insert(method);
  if (error) throw error;
}

/**
 * Deletes the signed-in customer's account and personal data.
 * Financial records (orders, vouchers) stay with the vendor and recipient.
 * Throws when the account belongs to a vendor, partner or business buyer.
 */
export async function deleteMyAccount(): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase().rpc('delete_my_account');
  if (error) throw error;
}

/** Removes a saved payment method. */
export async function removePaymentMethod(id: string): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase().from('payment_methods').delete().eq('id', id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------
 * Partner codes
 *
 * A partner (Snoonu, Talabat, Rafeeq) brings its own codes. We sell them like
 * any other gift and the customer types the partner's code into the partner's
 * app. We do not measure usage: using the code closes the whole value.
 * ---------------------------------------------------------------------- */

/** Reads the partner's own code so the customer can type it in. */
export async function revealEnterpriseCode(voucherId: string): Promise<string | null> {
  if (!hasSupabaseConfig) return null;
  const { data, error } = await getSupabase().rpc('reveal_enterprise_code', {
    p_voucher_id: voucherId,
  });
  if (error) throw error;
  return typeof data === 'string' && data.length > 0 ? data : null;
}

/** Marks a partner gift as used. The whole value is spent. */
export async function closeEnterpriseCode(
  voucherId: string,
): Promise<{ ok: boolean; reference?: string }> {
  if (!hasSupabaseConfig) return { ok: false };
  const { data, error } = await getSupabase().rpc('close_enterprise_code', {
    p_voucher_id: voucherId,
  });
  if (error) throw error;
  const result = (data ?? {}) as { status?: string; reference?: string };
  return { ok: result.status === 'redeemed', reference: result.reference };
}
/* -------------------------------------------------------------------------
 * Advertising
 *
 * Delivery and tracking go through security-definer RPCs. Impressions are only
 * written when the backend serves an ad, and clicks are deduplicated there.
 * ---------------------------------------------------------------------- */

const AD_VIEWER_KEY = 'giftly.advertising.viewer';
const AD_SESSION_ID = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

/** A stable anonymous key so frequency caps work between launches. */
export async function getAdViewerKey(): Promise<string> {
  const existing = await AsyncStorage.getItem(AD_VIEWER_KEY);
  if (existing) return existing;
  const key = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(AD_VIEWER_KEY, key);
  return key;
}

/** Asks the backend for the ads in a placement and its admin-set config. */
export async function listSponsoredAds(
  placementKey: string,
  limit = 5,
): Promise<SponsoredPlacement> {
  if (!hasSupabaseConfig) {
    return { placement: placementKey, ads: [], config: {} };
  }
  const supabase = getSupabase();
  const viewerKey = await getAdViewerKey();
  const [delivery, placement] = await Promise.all([
    supabase.rpc('advertising_deliver', {
      p_placement_key: placementKey,
      p_limit: limit,
      p_viewer_key: viewerKey,
      p_session_id: AD_SESSION_ID,
      p_context: { platform: 'mobile' },
    }),
    supabase
      .from('advertising_placements')
      .select('config')
      .eq('key', placementKey)
      .maybeSingle(),
  ]);
  if (delivery.error) throw delivery.error;
  const payload = (delivery.data ?? {}) as { ads?: SponsoredAd[] };
  return {
    placement: placementKey,
    ads: payload.ads ?? [],
    config: (placement.data?.config ?? {}) as Record<string, unknown>,
  };
}

/** Records a click and returns the canonical destination from the database. */
export async function trackSponsoredClick(
  impressionId: string,
): Promise<Partial<SponsoredAd> | null> {
  if (!hasSupabaseConfig) return null;
  const { data, error } = await getSupabase().rpc('advertising_track_click', {
    p_impression_id: impressionId,
    p_request_id: `click_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    p_viewer_key: await getAdViewerKey(),
    p_session_id: AD_SESSION_ID,
  });
  if (error) return null;
  return (data ?? null) as Partial<SponsoredAd> | null;
}

/** Attributes a purchase to the most recent touch inside the rule window. */
export async function trackSponsoredConversion(
  campaignId: string,
  options: {
    clickId?: string | null;
    orderId?: string | null;
    voucherId?: string | null;
    valueMinor?: number;
    requestId?: string;
  } = {},
): Promise<string | null> {
  if (!hasSupabaseConfig) return null;
  const { data, error } = await getSupabase().rpc('advertising_track_conversion', {
    p_campaign_id: campaignId,
    p_click_id: options.clickId ?? null,
    p_order_id: options.orderId ?? null,
    p_voucher_id: options.voucherId ?? null,
    p_value_minor: options.valueMinor ?? 0,
    p_conversion_type: 'purchase',
    p_request_id:
      options.requestId ??
      `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    p_metadata: { source: 'mobile' },
  });
  if (error) return null;
  return typeof data === 'string' ? data : null;
}
