import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Typed wrappers around the aggregate RPCs in
 * `supabase/migrations/0127_dashboard_aggregates.sql`.
 *
 * The KPI cards used to be summed from a capped page of rows, so they stopped
 * growing once a table passed the cap. These totals come from SQL instead and
 * therefore do not depend on how many rows a page loads for its tables.
 */

export interface VendorSalesTotals {
  paidItems: number;
  paidOrders: number;
  grossMinor: number;
  commissionMinor: number;
  shareMinor: number;
}

export interface VendorTopProduct {
  title: string | null;
  grossMinor: number;
  units: number;
}

export interface VendorVoucherTotals {
  total: number;
  active: number;
  redeemed: number;
  expired: number;
  outstandingMinor: number;
}

export interface VendorRedemptionTotals {
  redemptions: number;
  amountMinor: number;
  sessions: number;
}

export interface AdminOrderTotals {
  total: number;
  paid: number;
  pending: number;
  refunded: number;
  paidValueMinor: number;
}

export interface AdminVoucherTotals {
  total: number;
  active: number;
  redeemed: number;
  expired: number;
  outstandingMinor: number;
}

export interface AdminProductTotals {
  total: number;
  published: number;
  experience: number;
  enterpriseCode: number;
}

export interface AdminCustomerTotals {
  accounts: number;
  suspended: number;
  withOrders: number;
  paidOrders: number;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function callRpc(
  supabase: SupabaseClient,
  fn: string,
  args?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  const row: unknown = Array.isArray(data) ? data[0] : data;
  return (row as Record<string, unknown> | null) ?? {};
}

function vendorArgs(vendorId: string, since?: string): Record<string, unknown> {
  const args: Record<string, unknown> = { p_vendor_id: vendorId };
  if (since) args.p_since = since;
  return args;
}

export async function vendorSalesTotals(
  supabase: SupabaseClient,
  vendorId: string,
  since?: string,
): Promise<VendorSalesTotals> {
  const row = await callRpc(supabase, 'vendor_sales_totals', vendorArgs(vendorId, since));
  return {
    paidItems: num(row.paid_items),
    paidOrders: num(row.paid_orders),
    grossMinor: num(row.gross_minor),
    commissionMinor: num(row.commission_minor),
    shareMinor: num(row.share_minor),
  };
}

export async function vendorTopProducts(
  supabase: SupabaseClient,
  vendorId: string,
  options?: { since?: string; limit?: number },
): Promise<VendorTopProduct[]> {
  const { data, error } = await supabase.rpc('vendor_top_products', {
    ...vendorArgs(vendorId, options?.since),
    p_limit: options?.limit ?? 5,
  });
  if (error) throw new Error(`vendor_top_products failed: ${error.message}`);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: Record<string, unknown>) => ({
    title: (row.product_title as string | null) ?? null,
    grossMinor: num(row.gross_minor),
    units: num(row.units),
  }));
}

export async function vendorVoucherTotals(
  supabase: SupabaseClient,
  vendorId: string,
  since?: string,
): Promise<VendorVoucherTotals> {
  const row = await callRpc(supabase, 'vendor_voucher_totals', vendorArgs(vendorId, since));
  return {
    total: num(row.total),
    active: num(row.active),
    redeemed: num(row.redeemed),
    expired: num(row.expired),
    outstandingMinor: num(row.outstanding_minor),
  };
}

export async function vendorRedemptionTotals(
  supabase: SupabaseClient,
  vendorId: string,
  since?: string,
): Promise<VendorRedemptionTotals> {
  const row = await callRpc(supabase, 'vendor_redemption_totals', vendorArgs(vendorId, since));
  return {
    redemptions: num(row.redemptions),
    amountMinor: num(row.amount_minor),
    sessions: num(row.sessions),
  };
}

export async function adminOrderTotals(
  supabase: SupabaseClient,
  since?: string,
): Promise<AdminOrderTotals> {
  const row = await callRpc(supabase, 'admin_order_totals', since ? { p_since: since } : {});
  return {
    total: num(row.total),
    paid: num(row.paid),
    pending: num(row.pending),
    refunded: num(row.refunded),
    paidValueMinor: num(row.paid_value_minor),
  };
}

export async function adminVoucherTotals(
  supabase: SupabaseClient,
  since?: string,
): Promise<AdminVoucherTotals> {
  const row = await callRpc(supabase, 'admin_voucher_totals', since ? { p_since: since } : {});
  return {
    total: num(row.total),
    active: num(row.active),
    redeemed: num(row.redeemed),
    expired: num(row.expired),
    outstandingMinor: num(row.outstanding_minor),
  };
}

export async function adminProductTotals(
  supabase: SupabaseClient,
): Promise<AdminProductTotals> {
  const row = await callRpc(supabase, 'admin_product_totals');
  return {
    total: num(row.total),
    published: num(row.published),
    experience: num(row.experience),
    enterpriseCode: num(row.enterprise_code),
  };
}

export async function adminCustomerTotals(
  supabase: SupabaseClient,
): Promise<AdminCustomerTotals> {
  const row = await callRpc(supabase, 'admin_customer_totals');
  return {
    accounts: num(row.accounts),
    suspended: num(row.suspended),
    withOrders: num(row.with_orders),
    paidOrders: num(row.paid_orders),
  };
}

export async function adminSupportOpenCount(
  supabase: SupabaseClient,
): Promise<number> {
  const row = await callRpc(supabase, 'admin_support_open_count');
  return num(row.open_count);
}
