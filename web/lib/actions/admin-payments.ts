'use server';

import { str, optional, back, moneyField, intField, checkbox } from './_form';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import {
  clearMyFatoorahConfigCache,
  GIFT_PAYMENTS_SETTINGS_KEY,
  getPaymentMyFatoorahConfig,
  minorToMajor,
} from '@/lib/myfatoorah';

/** Admin-entered config is used by both web routes and Edge Functions. */
export async function adminSavePaymentProviderSettings(formData: FormData) {
  const ctx = await requireAdmin();
  const path = '/admin/payment-management';

  let apiKey = str(formData, 'api_key');
  const baseUrl = str(formData, 'base_url').replace(/\/+$/, '') || 'https://apitest.myfatoorah.com';
  let webhookSecret = str(formData, 'webhook_secret');
  const appPublicUrl = str(formData, 'app_public_url').replace(/\/+$/, '');

  if (!apiKey || !webhookSecret) {
    const { data: current } = await ctx.supabase
      .from('system_settings')
      .select('value')
      .eq('key', GIFT_PAYMENTS_SETTINGS_KEY)
      .maybeSingle();
    const saved = (current?.value ?? {}) as Record<string, unknown>;
    apiKey = apiKey || (typeof saved.api_key === 'string' ? saved.api_key : '');
    webhookSecret = webhookSecret || (typeof saved.webhook_secret === 'string' ? saved.webhook_secret : '');
  }

  if (!apiKey) back(path, 'Enter the MyFatoorah API key.');
  if (!/^https?:\/\//i.test(baseUrl)) back(path, 'Enter a valid API base URL.');
  if (!webhookSecret) back(path, 'Enter the webhook secret from the MyFatoorah portal.');
  if (!/^https?:\/\//i.test(appPublicUrl)) back(path, 'Enter the public app URL.');

  const { error } = await ctx.supabase.from('system_settings').upsert(
    {
      key: GIFT_PAYMENTS_SETTINGS_KEY,
      value: {
        api_key: apiKey,
        base_url: baseUrl,
        webhook_secret: webhookSecret,
        app_public_url: appPublicUrl,
      },
      description: 'MyFatoorah gift-card supplier and checkout configuration',
      is_public: false,
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  if (error) back(path, error.message);

  clearMyFatoorahConfigCache(GIFT_PAYMENTS_SETTINGS_KEY);
  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  supplierCount?: number;
  environment?: string;
}

/** Calls GetSuppliers with the saved config to prove the key works. */
export async function adminTestPaymentProviderConnection(): Promise<ProviderTestResult> {
  await requireAdmin();
  const config = await getPaymentMyFatoorahConfig();
  if (!config.apiKey) return { ok: false, message: 'No API key configured.' };

  try {
    const response = await fetch(`${config.baseUrl}/v2/GetSuppliers`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, message: `MyFatoorah returned HTTP ${response.status}.` };
    }
    const suppliers = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as any)?.Data)
        ? (payload as any).Data
        : null;
    if (!suppliers) return { ok: false, message: 'Unexpected response from GetSuppliers.' };
    return {
      ok: true,
      message: `Connected. ${suppliers.length} supplier(s) in this account.`,
      supplierCount: suppliers.length,
      environment: config.baseUrl.includes('apitest') ? 'Test' : 'Live',
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Connection failed.' };
  }
}

/** Form wrapper so the connection test can be triggered from a server form. */
export async function adminTestPaymentProviderConnectionForm() {
  await requireAdmin();
  const result = await adminTestPaymentProviderConnection();
  const path = '/admin/payment-management';
  redirect(
    `${path}?test=${result.ok ? 'ok' : 'fail'}&detail=${encodeURIComponent(result.message)}`,
  );
}

/** Records a settlement confirmed from a MyFatoorah deposit/statement. */
export async function adminRecordVendorSettlement(formData: FormData) {
  const ctx = await requireAdmin();
  const path = '/admin/settlements';
  const vendorId = str(formData, 'vendor_id');
  const reference = str(formData, 'settlement_reference');
  const amountMinor = Number.parseInt(str(formData, 'amount_minor'), 10);
  const status = str(formData, 'status') || 'pending';
  const settlementDate = str(formData, 'settlement_date');

  if (!vendorId) back(path, 'Choose a vendor.');
  if (!reference) back(path, 'Enter the provider or bank reference.');
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) back(path, 'Enter a valid amount.');

  const { error } = await ctx.supabase.rpc('admin_record_vendor_settlement', {
    p_vendor_id: vendorId,
    p_settlement_reference: reference,
    p_amount_minor: amountMinor,
    p_status: status,
    p_settlement_date: settlementDate ? `${settlementDate}T12:00:00Z` : null,
    p_supplier_code: str(formData, 'supplier_code') || null,
    p_notes: str(formData, 'notes') || null,
  });
  if (error) back(path, error.message.replace(/_/g, ' '));

  revalidatePath(path);
  revalidatePath('/vendor/financial');
  redirect(`${path}?recorded=1`);
}

/**
 * Admin-initiated refund. Uses the documented v2 MakeSupplierRefund endpoint
 * with the supplier allocation recorded on the payment.
 */
export async function adminProcessMyFatoorahRefund(formData: FormData) {
  const ctx = await requireAdmin();
  const orderId = str(formData, 'order_id');
  const amountMinor = Number.parseInt(str(formData, 'amount_minor'), 10);
  const path = '/admin/payment-management';
  if (!orderId || !Number.isFinite(amountMinor) || amountMinor <= 0) {
    back(path, 'Invalid refund request.');
  }

  const config = await getPaymentMyFatoorahConfig();
  if (!config.apiKey) back(path, 'MyFatoorah is not configured.');

  const { data: payment } = await ctx.supabase
    .from('myfatoorah_payments')
    .select('id, invoice_id, supplier_code')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!payment) back(path, 'Payment not found for that order.');

  // A multi-vendor order was charged to several suppliers. The provider must
  // deduct the refund from each of them in proportion to what it was paid,
  // not from whichever supplier happens to be first on the payment row.
  const { data: allocations } = await ctx.supabase
    .from('myfatoorah_payment_allocations')
    .select('supplier_code, invoice_share_minor')
    .eq('payment_id', payment.id)
    .order('invoice_share_minor', { ascending: false });

  const shares = (allocations ?? [])
    .map((row) => ({
      supplierCode: String(row.supplier_code ?? ''),
      shareMinor: Number(row.invoice_share_minor ?? 0),
    }))
    .filter((row) => row.supplierCode && row.shareMinor > 0);
  const allocatedMinor = shares.reduce((sum, row) => sum + row.shareMinor, 0);

  let refundRemaining = amountMinor;
  const suppliers = shares.length > 0 && allocatedMinor > 0
    ? shares
        .map((row, index) => {
          const share = index === shares.length - 1
            ? refundRemaining
            : Math.min(
                refundRemaining,
                Math.floor((amountMinor * row.shareMinor) / allocatedMinor),
              );
          refundRemaining -= share;
          return {
            SupplierCode: Number(row.supplierCode),
            SupplierDeductedAmount: minorToMajor(share),
          };
        })
        .filter((row) => Number(row.SupplierDeductedAmount) > 0)
    : payment.supplier_code
      ? [{ SupplierCode: Number(payment.supplier_code), SupplierDeductedAmount: minorToMajor(amountMinor) }]
      : [];

  const externalIdentifier = `giftly-refund-${orderId}-${Date.now()}`;
  try {
    const response = await fetch(`${config.baseUrl}/v2/MakeSupplierRefund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        KeyType: 'InvoiceId',
        Key: payment.invoice_id,
        Comment: 'Gift card order refund initiated by Giftly administrator.',
        ExternalIdentifier: externalIdentifier,
        Suppliers: suppliers,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || (payload as any)?.IsSuccess !== true && String((payload as any)?.IsSuccess).toLowerCase() !== 'true') {
      back(path, `Refund request failed: ${String((payload as any)?.Message ?? `HTTP ${response.status}`)}`);
    }

    const { error } = await ctx.supabase.rpc('myfatoorah_payment_refunded', {
      p_order_id: orderId,
      p_amount_minor: amountMinor,
      p_refund_reference: String((payload as any)?.Data?.RefundReference ?? externalIdentifier),
      p_status: 'pending',
      p_provider_response: (payload as any)?.Data ?? {},
    });
    if (error) back(path, error.message);
  } catch (error) {
    back(path, error instanceof Error ? error.message : 'Refund request failed.');
  }

  revalidatePath(path);
  redirect(`${path}?refund=1`);
}
