// src/lib/types.ts
// Shared domain types. These mirror the database schema in supabase/migrations.

export type CardStatus = 'issued' | 'claimed' | 'redeemed' | 'expired' | 'voided';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type AccentTone = 'teal' | 'pink' | 'lavender' | 'gold' | 'sky';

/**
 * How a gift card is fulfilled and redeemed.
 * - `monetary`      : the balance is money and each redemption spends an amount.
 * - `experience`    : the card holds a number of sessions (a massage, a class, a
 *                     night at the hotel). Every redemption uses one session.
 * - `enterprise_code`: the card is fulfilled from a partner's own code
 *                     inventory and is confirmed by the partner.
 */
export type FulfilmentType = 'monetary' | 'experience' | 'enterprise_code';

export type CategoryId =
  | 'coffee'
  | 'dining'
  | 'desserts'
  | 'wellness'
  | 'shopping'
  | 'experiences'
  | 'beauty'
  | 'fitness'
  | 'entertainment';
export type OccasionId =
  | 'birthday'
  | 'anniversary'
  | 'wedding'
  | 'graduation'
  | 'thank-you'
  | 'congratulations'
  | 'just-because'
  | 'seasonal';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  preferred_language: 'en' | 'ar';
  is_admin: boolean;
  created_at: string;
}

export interface Vendor {
  id: string;
  owner_id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url?: string | null;
  status: VendorStatus;
  commission_bps: number;
  max_unredeemed_minor: number;
  created_at: string;
}

export interface Offer {
  id: string;
  vendor_id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  image_url: string | null;
  min_amount_minor: number;
  max_amount_minor: number;
  preset_amounts_minor: number[];
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  vendor?: Pick<Vendor, 'id' | 'name' | 'name_ar' | 'logo_url' | 'banner_url'>;
  // Presentation metadata used by the customer app.
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  icon?: string;
  tone?: AccentTone;
  category?: CategoryId;
  occasions?: OccasionId[];
  rating?: number;
  location?: string;
  /** Value cards spend money, experience cards spend sessions. */
  fulfilment_type?: FulfilmentType;
  /** Number of sessions included when `fulfilment_type` is `experience`. */
  session_count?: number;
}

export interface GiftCard {
  id: string;
  offer_id: string;
  order_id: string | null;
  buyer_id: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  original_value_minor: number;
  status: CardStatus;
  claim_token_hash: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  expires_at: string | null;
  created_at: string;
  /** Derived from ledger_entries, never stored on the row. */
  balance_minor?: number;
  vendor_name?: string;
  offer_title?: string;
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  icon?: string;
  tone?: AccentTone;
  delivery_status?: 'scheduled' | 'delivered' | 'opened';
  scheduled_for?: string | null;
  message?: string | null;
  /** Value cards spend money, experience cards spend sessions. */
  fulfilment_type?: FulfilmentType;
  /** Sessions included on issue (experience cards only). */
  total_sessions?: number;
  /** Sessions still available (experience cards only). */
  remaining_sessions?: number;
  /** Vendor that issued the card — used by the vendor dashboard. */
  vendor_id?: string;
}

/** One redemption against a gift card. */
export interface RedemptionEntry {
  id: string;
  card_id: string;
  /** A session was used, or money was spent. */
  kind: 'monetary' | 'session' | 'enterprise_code';
  /** Sessions consumed (always 1 for a session redemption). */
  sessions?: number;
  /** Minor units spent on a value card. */
  amount_minor?: number;
  /** Who performed the redemption — the vendor, or the card holder in demo. */
  actor: string;
  created_at: string;
  note?: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  offer_id: string;
  amount_minor: number;
  commission_minor: number;
  vendor_share_minor: number;
  status: OrderStatus;
  payment_reference: string;
  created_at: string;
  gift_card_id?: string | null;
}

export interface LedgerEntry {
  id: string;
  card_id: string;
  order_id: string | null;
  entry_type: 'issue' | 'redeem' | 'refund' | 'void';
  amount_minor: number; // signed: negative for redemptions
  created_at: string;
}

export interface Stat {
  label: string;
  value: string;
  hint?: string;
}

export interface Recipient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  relation?: string;
}

export type NotificationKind =
  | 'received'
  | 'delivered'
  | 'opened'
  | 'redeemed'
  | 'expiry'
  | 'promo';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  titleKey: string;
  bodyKey: string;
  created_at: string;
  read: boolean;
  gift_id?: string;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
}

export interface BusinessLocation {
  id: string;
  vendorId: string;
  area: string;
  address: string;
  hours: string;
}

export type BasketStatus = 'open' | 'ready' | 'completed';

/** A single voucher that has been dropped into a collaborative gift basket. */
export interface BasketItem {
  id: string;
  offer_id: string;
  vendor_id: string;
  vendor_name: string;
  title: string;
  amount_minor: number;
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  icon?: string;
  tone?: AccentTone;
  logo_url?: string | null;
  banner_url?: string | null;
  added_by_id: string;
  added_by_name: string;
  added_at: string;
}

export interface BasketParticipant {
  id: string;
  name: string;
  is_owner: boolean;
  joined_at: string;
  tone: 'teal' | 'pink' | 'lavender' | 'gold';
}

export type BasketActivityKind = 'created' | 'joined' | 'item_added' | 'ready' | 'completed';

export interface BasketActivity {
  id: string;
  kind: BasketActivityKind;
  actor_name: string;
  item_title?: string;
  amount_minor?: number;
  created_at: string;
}

export interface GiftBasket {
  id: string;
  code: string;
  name: string;
  recipient_name: string;
  occasion: OccasionId;
  creator_id: string;
  creator_name: string;
  /** Optional group goal in minor units. 0 means no goal. */
  target_minor: number;
  status: BasketStatus;
  items: BasketItem[];
  participants: BasketParticipant[];
  activity: BasketActivity[];
  created_at: string;
  completed_at?: string | null;
  note?: string;
}
