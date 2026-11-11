// src/lib/data.ts
// Read/write helpers for the customer app. When Supabase is configured these
// query the real database through RLS-protected tables. Before credentials are
// added, they fall back to demo data so the UI can be built and tested.
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
  AccentTone,
  CustomerAddress,
  CustomerPreferences,
  SupportRequest,
  AppNotification,
  BusinessLocation,
  CardStatus,
  GiftCard,
  LedgerEntry,
  NotificationKind,
  Offer,
  Order,
  PaymentMethod,
  ProductVariant,
  Recipient,
  RedemptionEntry,
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

export interface OfferWithBalance extends Offer {}

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
  product?: { title: string | null; icon: string | null; tone: string | null } | { title: string | null; icon: string | null; tone: string | null }[] | null;
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
    offer_title: product?.title ?? undefined,
    icon: product?.icon ?? 'gift',
    tone: resolveTone(product?.tone),
    delivery_status: (row.delivery_status as GiftCard['delivery_status']) ?? undefined,
    scheduled_for: row.scheduled_for,
    message: row.gift_message,
    fulfilment_type: row.fulfilment_type as GiftCard['fulfilment_type'],
    total_sessions: row.total_sessions ?? undefined,
    remaining_sessions: row.remaining_sessions ?? undefined,
  };
}

/** Every voucher the signed in customer can see, newest first. */
export async function listMyVouchers(): Promise<GiftCard[]> {
  if (!hasSupabaseConfig) {
    return MOCK_CARDS;
  }
  const { data, error } = await getSupabase()
    .from('vouchers')
    .select(
      'id, voucher_code, qr_payload, product_id, vendor_id, buyer_id, claimed_by, recipient_name, recipient_email, fulfilment_type, status, initial_value_minor, remaining_value_minor, total_sessions, remaining_sessions, used_sessions, currency, delivery_status, scheduled_for, gift_message, expires_at, created_at, product:products(title, icon, tone), vendor:vendors(name, logo_url)',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as VoucherRow[]).map(mapVoucher);
}

/** The redemption history for the given vouchers. */
export async function listRedemptionsFor(voucherIds: string[]): Promise<RedemptionEntry[]> {
  if (!hasSupabaseConfig) return MOCK_REDEMPTIONS;
  if (voucherIds.length === 0) return [];
  const { data, error } = await getSupabase()
    .from('ledger_entries')
    .select('id, voucher_id, entry_type, amount_minor, sessions, created_at')
    .in('voucher_id', voucherIds)
    .neq('entry_type', 'issue');
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
}

/** The customer's favourite businesses and products. */
export async function listFavourites(): Promise<Offer[]> {
  if (!hasSupabaseConfig) return [];
  const { data, error } = await getSupabase()
    .from('favourites')
    .select('product_id, vendor_id, product:products(*, vendor:vendors(id, name, name_ar, logo_url, banner_url)), vendor:vendors(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown[])
    .map((row) => {
      const entry = row as {
        product: (Offer & { vendor?: Offer['vendor'] }) | null;
        vendor: Offer['vendor'] | null;
      };
      if (entry.product) return entry.product;
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

export async function listActiveOffers(): Promise<Offer[]> {
  if (!hasSupabaseConfig) {
    return MOCK_OFFERS.filter((o) => o.is_active);
  }
  const { data, error } = await getSupabase()
    .from('products')
    .select(
      '*, vendor:vendors(id, name, name_ar, logo_url, banner_url), category:categories(slug), variants:product_variants(*)',
    )
    .eq('is_active', true)
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as OfferRow[]).map(mapOffer);
}

export async function getOffer(id: string): Promise<Offer | null> {
  if (!hasSupabaseConfig) {
    return MOCK_OFFERS.find((o) => o.id === id) ?? null;
  }
  const { data, error } = await getSupabase()
    .from('products')
    .select(
      '*, vendor:vendors(id, name, name_ar, logo_url, banner_url), category:categories(slug), variants:product_variants(*)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOffer(data as OfferRow) : null;
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

/**
 * The notification centre reads straight from the database, so "mark as read"
 * survives leaving the screen.
 */
export async function listNotifications(): Promise<AppNotification[]> {
  if (!hasSupabaseConfig) {
    return MOCK_NOTIFICATIONS;
  }
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('id, kind, title_key, body_key, payload, read_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as NotificationRow[]).map((row) => ({
    id: row.id,
    kind: row.kind as NotificationKind,
    titleKey: row.title_key,
    bodyKey: row.body_key,
    created_at: row.created_at,
    read: Boolean(row.read_at),
    gift_id: (row.payload as { gift_id?: string } | null)?.gift_id,
  }));
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
  const { error } = await getSupabase().from('customer_addresses').insert(address);
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
  const { error } = await getSupabase().from('support_requests').insert(input);
  if (error) throw error;
}

/** The support requests the customer sent. */
export async function listSupportRequests(): Promise<SupportRequest[]> {
  if (!hasSupabaseConfig) return [];
  const { data, error } = await getSupabase()
    .from('support_requests')
    .select('id, kind, subject, body, reference, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupportRequest[];
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

/** Removes a saved payment method. */
export async function removePaymentMethod(id: string): Promise<void> {
  if (!hasSupabaseConfig) return;
  const { error } = await getSupabase().from('payment_methods').delete().eq('id', id);
  if (error) throw error;
}
