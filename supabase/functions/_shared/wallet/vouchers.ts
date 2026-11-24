// supabase/functions/_shared/wallet/vouchers.ts
// Reads the voucher a pass is built from, with the service role.
//
// The pass service acts for the holder, so the row is loaded with the service
// role and the caller is checked separately (see the `links` action).

import { adminClient } from '../clients.ts';
import type { WalletVoucher } from './content.ts';

interface VoucherRow {
  id: string;
  status: string;
  currency: string | null;
  initial_value_minor: number | null;
  remaining_value_minor: number | null;
  total_sessions: number | null;
  remaining_sessions: number | null;
  expires_at: string | null;
  buyer_id: string | null;
  claimed_by: string | null;
  product: { title: string | null; partner: { name: string | null } | null } | null;
  vendor: { name: string | null } | null;
}

export interface VoucherForPass {
  voucher: WalletVoucher;
  buyerId: string | null;
  claimedBy: string | null;
}

const COLUMNS =
  'id, status, currency, initial_value_minor, remaining_value_minor, total_sessions, ' +
  'remaining_sessions, expires_at, buyer_id, claimed_by, ' +
  'product:products(title, partner:enterprise_partners(name)), vendor:vendors(name)';

function toMinor(value: number | null, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function loadVoucherForPass(voucherId: string): Promise<VoucherForPass | null> {
  if (!/^[0-9a-f-]{36}$/i.test(voucherId)) return null;

  const { data, error } = await adminClient()
    .from('vouchers')
    .select(COLUMNS)
    .eq('id', voucherId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as VoucherRow;
  const vendorName =
    row.product?.partner?.name ?? row.vendor?.name ?? row.product?.title ?? 'Tazella';

  return {
    buyerId: row.buyer_id,
    claimedBy: row.claimed_by,
    voucher: {
      id: row.id,
      vendorName,
      currency: row.currency ?? 'QAR',
      balanceMinor: toMinor(row.remaining_value_minor, toMinor(row.initial_value_minor)),
      expiresAt: row.expires_at,
      status: row.status,
      totalSessions: row.total_sessions,
      remainingSessions: row.remaining_sessions,
    },
  };
}

/** The signed-in caller, or null. */
export async function callerId(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}
