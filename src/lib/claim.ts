// src/lib/claim.ts
// The public claim flow.
//
// The link carries a secret token. The database hashes it, so the raw token is
// never stored. The app asks the database what the gift is, and claims it once
// the recipient is signed in.
import { getSupabase } from './supabase';
import { hasSupabaseConfig } from './env';

export interface ClaimGift {
  voucherId: string;
  voucherCode: string | null;
  vendor: string;
  title: string;
  amountMinor: number;
  remainingValueMinor: number | null;
  totalSessions: number | null;
  remainingSessions: number | null;
  sender: string;
  message: string | null;
  expiresAt: string | null;
  status: string;
  fulfilmentType: string;
}

/** Reads the gift behind a claim token, without claiming it. */
export async function fetchClaimGift(token: string): Promise<ClaimGift | null> {
  if (!hasSupabaseConfig) return null;

  const { data, error } = await getSupabase().rpc('claim_preview', { p_token: token });
  if (error || !data) return null;

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        voucher_id: string;
        voucher_code: string | null;
        vendor_name: string | null;
        product_title: string | null;
        amount_minor: number;
        remaining_value_minor: number | null;
        total_sessions: number | null;
        remaining_sessions: number | null;
        sender_name: string | null;
        gift_message: string | null;
        expires_at: string | null;
        status: string;
        fulfilment_type: string;
      }
    | null;
  if (!row) return null;

  return {
    voucherId: row.voucher_id,
    voucherCode: row.voucher_code,
    vendor: row.vendor_name ?? 'Giftly',
    title: row.product_title ?? '',
    amountMinor: Number(row.amount_minor ?? 0),
    remainingValueMinor: row.remaining_value_minor,
    totalSessions: row.total_sessions,
    remainingSessions: row.remaining_sessions,
    sender: row.sender_name ?? '',
    message: row.gift_message,
    expiresAt: row.expires_at,
    status: row.status,
    fulfilmentType: row.fulfilment_type,
  };
}

/** Claims the gift for the signed in recipient. */
export async function claimGift(token: string): Promise<string | null> {
  if (!hasSupabaseConfig) return null;
  const { data, error } = await getSupabase().rpc('claim_voucher', { p_token: token });
  if (error) return null;
  return (data as string | null) ?? null;
}
