import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getMyFatoorahPaymentStatus,
  isMyFatoorahConfigured,
  type MyFatoorahPaymentStatus,
} from '@/lib/myfatoorah';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdvertiserSurface = 'vendor' | 'enterprise';

export interface AdvertisingPaymentResult {
  ok: boolean;
  paid: boolean;
  campaignId: string | null;
  surface: AdvertiserSurface;
  reason?: string;
}

/**
 * Resolves and settles one MyFatoorah payment for an advertising campaign.
 *
 * Both the browser callback and the server-to-server webhook call this, so the
 * two paths can never disagree. The provider is always re-queried before the
 * campaign is marked paid, and `advertising_confirm_payment` is idempotent, so
 * replays and duplicate webhooks are harmless.
 */
export async function confirmMyFatoorahAdvertisingPayment(input: {
  paymentId?: string | null;
  invoiceId?: string | null;
  source: 'callback' | 'webhook';
  surface?: AdvertiserSurface;
}): Promise<AdvertisingPaymentResult> {
  const surface: AdvertiserSurface = input.surface ?? 'vendor';
  const fail = (reason: string): AdvertisingPaymentResult => ({
    ok: false,
    paid: false,
    campaignId: null,
    surface,
    reason,
  });

  if (!(await isMyFatoorahConfigured())) return fail('not_configured');
  if (!input.paymentId && !input.invoiceId) return fail('missing_payment_id');

  let status: MyFatoorahPaymentStatus;
  try {
    status = await getMyFatoorahPaymentStatus(
      input.paymentId
        ? { key: input.paymentId, keyType: 'PaymentId' }
        : { key: String(input.invoiceId), keyType: 'InvoiceId' },
    );
  } catch (error) {
    console.error('[advertising] myfatoorah status inquiry failed', error);
    return fail('status_inquiry_failed');
  }

  // The provider must agree with the value we were handed.
  if (input.invoiceId && status.invoiceId && String(input.invoiceId) !== status.invoiceId) {
    return fail('invoice_mismatch');
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  const campaign = await findCampaign(admin, {
    customerReference: status.customerReference,
    invoiceId: status.invoiceId || input.invoiceId || null,
  });
  if (!campaign) return fail('campaign_not_found');

  // Read the surface recorded when the invoice was created (before the confirm
  // call replaces the transaction payload with the provider's response).
  const pendingSurface = await readPendingSurface(admin, campaign.id);

  if (!status.paid) {
    return { ok: true, paid: false, campaignId: campaign.id, surface: pendingSurface };
  }

  const { error } = await admin.rpc('advertising_confirm_payment', {
    p_campaign_id: campaign.id,
    p_provider: 'myfatoorah',
    p_provider_reference: status.paymentId ?? input.paymentId ?? status.invoiceId,
    p_amount_minor: status.amountMinor || null,
    p_raw_payload: {
      source: `myfatoorah_${input.source}`,
      invoice_id: status.invoiceId,
      payment_id: status.paymentId,
      invoice_status: status.invoiceStatus,
      transaction_status: status.transactionStatus,
    },
  });

  if (error) {
    console.error('[advertising] could not confirm myfatoorah payment', error.message);
    return { ok: false, paid: false, campaignId: campaign.id, surface: pendingSurface, reason: error.message };
  }

  return { ok: true, paid: true, campaignId: campaign.id, surface: pendingSurface };
}

async function findCampaign(
  admin: SupabaseClient,
  refs: { customerReference: string | null; invoiceId: string | null },
): Promise<{ id: string } | null> {
  const reference = refs.customerReference?.trim() ?? '';
  if (UUID_RE.test(reference)) {
    const { data } = await admin
      .from('advertising_campaigns')
      .select('id')
      .eq('id', reference)
      .maybeSingle();
    if (data?.id) return data as { id: string };
  }

  if (refs.invoiceId) {
    const { data } = await admin
      .from('advertising_campaigns')
      .select('id')
      .eq('payment_reference', refs.invoiceId)
      .maybeSingle();
    if (data?.id) return data as { id: string };
  }

  return null;
}

async function readPendingSurface(admin: SupabaseClient, campaignId: string): Promise<AdvertiserSurface> {
  const { data } = await admin
    .from('advertising_transactions')
    .select('raw_payload')
    .eq('campaign_id', campaignId)
    .eq('kind', 'payment')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const surface = (data?.raw_payload as { surface?: string } | null)?.surface;
  return surface === 'enterprise' ? 'enterprise' : 'vendor';
}
