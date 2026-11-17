import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyFatoorahConfig, verifyMyFatoorahWebhookSignature } from '@/lib/myfatoorah';
import { confirmMyFatoorahAdvertisingPayment } from '@/lib/advertising-payments';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Server-to-server MyFatoorah webhook for advertising payments.
 *
 * Fails closed when the secure key is missing, verifies the
 * `myfatoorah-signature` header, records the event for idempotency, then
 * re-reads the payment from MyFatoorah before confirming it.
 */
export async function POST(request: Request) {
  const { webhookSecret } = await getMyFatoorahConfig();
  if (!webhookSecret) {
    console.error('[advertising] MYFATOORAH_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const raw = await request.text();
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const signature = request.headers.get('myfatoorah-signature') ?? '';
  if (!verifyMyFatoorahWebhookSignature(event?.Data, signature, webhookSecret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  if (event?.Event?.Name !== 'PAYMENT_STATUS_CHANGED') {
    return NextResponse.json({ received: true, ignored: true });
  }

  const data = event?.Data;
  const invoiceId = data?.Invoice?.Id ? String(data.Invoice.Id) : '';
  const invoiceStatus = String(data?.Invoice?.Status ?? '').toUpperCase();
  const transactionStatus = String(data?.Transaction?.Status ?? '').toUpperCase();
  const paymentId = data?.Transaction?.PaymentId ? String(data.Transaction.PaymentId) : '';

  if (invoiceStatus !== 'PAID' || transactionStatus !== 'SUCCESS') {
    return NextResponse.json({ received: true, ignored: true });
  }

  const eventId = String(
    event?.Event?.Reference ?? `${invoiceId}:${invoiceStatus}:${transactionStatus}:${paymentId}`,
  );
  const admin = createAdminClient();

  // Record first so a retry of the same event is visible and harmless.
  const { error: eventError } = await admin
    .from('payment_events')
    .upsert(
      { provider: 'myfatoorah', event_id: eventId, payload: event },
      { onConflict: 'event_id', ignoreDuplicates: true },
    );
  if (eventError) {
    console.error('[advertising] could not record myfatoorah event', eventError.message);
    return NextResponse.json({ error: 'event_store_failed' }, { status: 500 });
  }

  const result = await confirmMyFatoorahAdvertisingPayment({
    paymentId: paymentId || null,
    invoiceId: invoiceId || null,
    source: 'webhook',
  });

  if (!result.ok) {
    // 200 so MyFatoorah stops retrying a payment we can never map; the error is
    // logged for follow-up and the callback path stays available.
    console.error('[advertising] webhook could not confirm payment', result.reason);
    return NextResponse.json({ received: true, confirmed: false, reason: result.reason });
  }

  await admin
    .from('payment_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('event_id', eventId);

  return NextResponse.json({ received: true, confirmed: result.paid, campaignId: result.campaignId });
}
