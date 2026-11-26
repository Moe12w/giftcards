// src/lib/claim.ts
// The public claim flow.
//
// The link carries a secret token. The database hashes it, so the raw token is
// never stored. The app asks the database what the gift is, and claims it once
// the recipient is signed in.
import { getSupabase } from './supabase';
import { env, hasSupabaseConfig } from './env';

export interface ClaimGift {
  voucherId: string;
  vendor: string;
  title: string;
  amountMinor: number;
  remainingValueMinor: number | null;
  totalSessions: number | null;
  remainingSessions: number | null;
  sender: string;
  message: string | null;
  /** Chosen cover, resolved to an image when it came from the catalogue. */
  coverId: string | null;
  coverImageUrl: string | null;
  coverName: string | null;
  wrapping: string | null;
  media: {
    type: 'photo' | 'gif' | 'video' | 'audio';
    url: string;
    mimeType?: string | null;
    durationMs?: number | null;
  }[];
  expiresAt: string | null;
  status: string;
  fulfilmentType: string;
}

/** Reads the gift behind a claim token, without claiming it. */
export async function fetchClaimGift(token: string): Promise<ClaimGift | null> {
  if (!hasSupabaseConfig) return null;

  // The lookup runs behind an Edge Function, because the database function
  // enforces a per-caller limit from the address the function runtime observes.
  let data: unknown = null;
  try {
    const response = await fetch(`${env.supabaseUrl}/functions/v1/claim-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { gift?: unknown } | null;
    data = payload?.gift ?? null;
  } catch {
    return null;
  }
  if (!data) return null;

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        voucher_id: string;
        vendor_name: string | null;
        product_title: string | null;
        amount_minor: number;
        remaining_value_minor: number | null;
        total_sessions: number | null;
        remaining_sessions: number | null;
        sender_name: string | null;
        gift_message: string | null;
        gift_cover_id: string | null;
        gift_wrapping: string | null;
        gift_media:
          | { type: string; url: string; mimeType?: string | null; durationMs?: number | null }
          | { type: string; url: string; mimeType?: string | null; durationMs?: number | null }[]
          | null;
        expires_at: string | null;
        status: string;
        fulfilment_type: string;
      }
    | null;
  if (!row) return null;

  // Uploaded covers are stored by id; resolve the image for the card art. A
  // built-in design has no row and falls back to its code-defined artwork.
  let coverImageUrl: string | null = null;
  let coverName: string | null = null;
  if (row.gift_cover_id) {
    try {
      const { data: cover } = await getSupabase()
        .from('gift_covers')
        .select('name, name_ar, image_url')
        .eq('id', row.gift_cover_id)
        .maybeSingle();
      if (cover) {
        coverImageUrl = (cover.image_url as string) ?? null;
        coverName = (cover.name as string) ?? null;
      }
    } catch {
      // A missing catalogue row just means the built-in artwork is used.
    }
  }

  const rawMedia = row.gift_media;
  const list = Array.isArray(rawMedia) ? rawMedia : rawMedia ? [rawMedia] : [];
  const media = list
    .filter((item): item is { type: string; url: string; mimeType?: string | null; durationMs?: number | null } =>
      Boolean(item && ['photo', 'gif', 'video', 'audio'].includes(item.type) && item.url),
    )
    .map((item) => ({
      type: item.type as 'photo' | 'gif' | 'video' | 'audio',
      url: item.url,
      mimeType: item.mimeType ?? null,
      durationMs: item.durationMs ?? null,
    }));

  return {
    voucherId: row.voucher_id,
    vendor: row.vendor_name ?? 'Tazella',
    title: row.product_title ?? '',
    amountMinor: Number(row.amount_minor ?? 0),
    remainingValueMinor: row.remaining_value_minor,
    totalSessions: row.total_sessions,
    remainingSessions: row.remaining_sessions,
    sender: row.sender_name ?? '',
    message: row.gift_message,
    coverId: row.gift_cover_id,
    coverImageUrl,
    coverName,
    wrapping: row.gift_wrapping,
    media,
    expiresAt: row.expires_at,
    status: row.status,
    fulfilmentType: row.fulfilment_type,
  };
}

/**
 * Claims the gift for the signed in recipient.
 * Throws on failure so callers never navigate to a false success screen.
 */
export async function claimGift(token: string): Promise<string | null> {
  if (!hasSupabaseConfig) throw new Error('Claiming is unavailable in demo mode.');
  const { data, error } = await getSupabase().rpc('claim_voucher', { p_token: token });
  if (error) throw new Error(error.message || 'Could not claim this gift.');
  return (data as string | null) ?? null;
}

/**
 * Claims a sent basket for the signed-in recipient.
 * Throws on failure so callers never navigate to a false success screen.
 */
export async function claimBasket(token: string): Promise<string | null> {
  if (!hasSupabaseConfig) throw new Error('Claiming is unavailable in demo mode.');
  const { data, error } = await getSupabase().rpc('claim_basket', { p_token: token });
  if (error) throw new Error(error.message || 'Could not claim this basket.');
  return (data as string | null) ?? null;
}

export interface ClaimBasket {
  basketId: string;
  name: string;
  recipientName: string;
  occasion: string;
  coverId: string | null;
  creatorName: string;
  note: string | null;
  itemCount: number;
  totalMinor: number;
  status: string;
}

/** Reads the basket behind a claim token, without claiming it. */
export async function fetchClaimBasket(token: string): Promise<ClaimBasket | null> {
  if (!hasSupabaseConfig) return null;

  let data: unknown = null;
  try {
    const response = await fetch(`${env.supabaseUrl}/functions/v1/basket-claim-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { basket?: unknown } | null;
    data = payload?.basket ?? null;
  } catch {
    return null;
  }
  if (!data) return null;

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        basket_id: string;
        name: string;
        recipient_name: string;
        occasion: string;
        cover_id: string | null;
        creator_name: string;
        note: string | null;
        item_count: number;
        total_minor: number;
        status: string;
      }
    | null;
  if (!row) return null;

  return {
    basketId: row.basket_id,
    name: row.name,
    recipientName: row.recipient_name,
    occasion: row.occasion,
    coverId: row.cover_id,
    creatorName: row.creator_name,
    note: row.note,
    itemCount: row.item_count,
    totalMinor: Number(row.total_minor ?? 0),
    status: row.status,
  };
}
