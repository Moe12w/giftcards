// supabase/functions/payment-webhook/index.ts
// MyFatoorah webhook receiver for gift-card payments, supplier KYC and refunds.
//
// Safety:
//  - Fails closed when the webhook secret is missing.
//  - Verifies the event-specific HMAC-SHA256 signature in constant time.
//  - Deduplicates by (provider, event_id) and skips already-processed events.
//  - Payment confirmation always re-queries MyFatoorah server-to-server.
import { adminClient, randomToken } from '../_shared/clients.ts';
import { json } from '../_shared/cors.ts';
import { logProviderError, mfConfig } from '../_shared/myfatoorah.ts';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacBase64(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function value(x: unknown): string {
  return x === null || x === undefined ? '' : String(x);
}

function signaturePayload(name: string, data: any): string {
  if (name === 'SUPPLIER_STATUS_CHANGED') {
    return `Supplier.Code=${value(data?.Supplier?.Code)},KycDecision.Status=${value(data?.KycDecision?.Status)}`;
  }
  if (name === 'REFUND_STATUS_CHANGED') {
    return [
      `Refund.Id=${value(data?.Refund?.Id)}`,
      `Refund.Status=${value(data?.Refund?.Status)}`,
      `Amount.ValueInBaseCurrency=${value(data?.Amount?.ValueInBaseCurrency)}`,
      `ReferencedInvoice.Id=${value(data?.ReferencedInvoice?.Id)}`,
    ].join(',');
  }
  return [
    `Invoice.Id=${value(data?.Invoice?.Id)}`,
    `Invoice.Status=${value(data?.Invoice?.Status)}`,
    `Transaction.Status=${value(data?.Transaction?.Status)}`,
    `Transaction.PaymentId=${value(data?.Transaction?.PaymentId)}`,
    `Invoice.ExternalIdentifier=${value(data?.Invoice?.ExternalIdentifier)}`,
  ].join(',');
}

function eventId(event: any, data: any): string {
  const reference = value(event?.Event?.Reference);
  if (reference) return reference;
  return [
    value(event?.Event?.Name),
    value(data?.Invoice?.Id),
    value(data?.Transaction?.PaymentId),
    value(data?.Invoice?.Status),
    value(data?.Transaction?.Status),
    value(data?.Supplier?.Code),
    value(data?.Refund?.Id),
  ].join(':');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const config = await mfConfig();
  const secret = config.webhookSecret;
  if (!secret) {
    console.error('payment-webhook: MYFATOORAH_WEBHOOK_SECRET is not configured');
    return json({ error: 'webhook_not_configured' }, 500);
  }

  try {
    const event = JSON.parse(await req.text());
    const name = value(event?.Event?.Name);
    const data = event?.Data ?? {};
    const header = req.headers.get('myfatoorah-signature') ?? '';
    const expected = await hmacBase64(secret, signaturePayload(name, data));
    if (!timingSafeEqual(header, expected)) return json({ error: 'invalid_signature' }, 401);

    const id = eventId(event, data);
    const admin = adminClient();

    const { data: seen } = await admin
      .from('webhook_events')
      .select('id, processed_at')
      .eq('provider', 'myfatoorah')
      .eq('event_id', id)
      .maybeSingle();
    if (seen?.processed_at) return json({ received: true, ignored: true, reason: 'duplicate' });

    await admin.from('webhook_events').upsert(
      { provider: 'myfatoorah', event_id: id, event_type: name, payload: event },
      { onConflict: 'provider,event_id', ignoreDuplicates: true },
    );

    const markProcessed = async () => {
      await admin
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('provider', 'myfatoorah')
        .eq('event_id', id);
    };

    if (name === 'PAYMENT_STATUS_CHANGED') {
      const invoiceId = value(data?.Invoice?.Id);
      const invoiceStatus = value(data?.Invoice?.Status).toUpperCase();
      const txStatus = value(data?.Transaction?.Status).toUpperCase();

      if (invoiceStatus === 'PAID' && txStatus === 'SUCCESS' && invoiceId) {
        const appUrl = config.appPublicUrl;
        const internalKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        if (!appUrl || !internalKey) throw new Error('confirmation_endpoint_not_configured');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 40_000);
        let confirmResponse: Response;
        try {
          confirmResponse = await fetch(`${appUrl}/api/merchant-payment/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-key': internalKey },
            body: JSON.stringify({
              invoiceId,
              paymentId: value(data?.Transaction?.PaymentId),
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        const result = await confirmResponse.json().catch(() => ({}));
        if (!confirmResponse.ok || result.error) {
          throw new Error(`confirmation_failed: ${String(result.error ?? confirmResponse.status)}`);
        }
        await markProcessed();
        return json({ received: true, confirmed: result.confirmed === true });
      }

      // Failed / cancelled / refunded notifications only update our status.
      const mapped = invoiceStatus === 'REFUNDED' ? 'refunded' : txStatus === 'FAILED' ? 'failed' : null;
      if (mapped && invoiceId) {
        await admin.from('orders')
          .update({ status: mapped as any, payment_status: mapped as any })
          .eq('provider_invoice_id', invoiceId);
      }
      await markProcessed();
      return json({ received: true, ignored: true });
    }

    if (name === 'SUPPLIER_STATUS_CHANGED') {
      const code = value(data?.Supplier?.Code);
      const kyc = value(data?.KycDecision?.Status).toUpperCase();
      if (!code) {
        await markProcessed();
        return json({ received: true, ignored: true });
      }
      const [vendorResult, partnerResult] = await Promise.all([
        admin.from('vendors').select('id').eq('myfatoorah_supplier_code', code).maybeSingle(),
        admin.from('enterprise_partners').select('id').eq('myfatoorah_supplier_code', code).maybeSingle(),
      ]);
      const owner = vendorResult.data
        ? { id: vendorResult.data.id, kind: 'vendor' as const }
        : partnerResult.data
          ? { id: partnerResult.data.id, kind: 'partner' as const }
          : null;
      if (owner) {
        const status = kyc === 'APPROVED' ? 'active' : kyc === 'REJECTED' ? 'rejected' : 'pending';
        const reasons = Array.isArray(data?.KycDecision?.RejectionReason)
          ? data.KycDecision.RejectionReason.map((r: any) => value(r?.Description)).filter(Boolean).join('; ')
          : '';
        const { error } = await admin.rpc(
          owner.kind === 'vendor' ? 'myfatoorah_supplier_synced' : 'myfatoorah_partner_synced',
          {
            [owner.kind === 'vendor' ? 'p_vendor_id' : 'p_partner_id']: owner.id,
            p_status: status,
            p_comment: reasons || null,
            p_raw: data,
          },
        );
        if (error) throw error;
      }
      await markProcessed();
      return json({ received: true, supplierCode: code, status: kyc });
    }

    if (name === 'REFUND_STATUS_CHANGED') {
      const refundId = value(data?.Refund?.Id) || value(data?.Refund?.RefundReference) || randomToken(12);
      const status = value(data?.Refund?.Status).toUpperCase();
      const invoiceId = value(data?.ReferencedInvoice?.Id);
      const amount = Number(data?.Amount?.ValueInBaseCurrency ?? 0);
      if (invoiceId && amount > 0 && status === 'REFUNDED') {
        const { data: payment } = await admin
          .from('myfatoorah_payments')
          .select('order_id')
          .eq('invoice_id', invoiceId)
          .maybeSingle();
        if (payment) {
          const { error } = await admin.rpc('myfatoorah_payment_refunded', {
            p_order_id: payment.order_id,
            p_amount_minor: Math.round(amount * 100),
            p_refund_reference: refundId,
            p_status: 'completed',
            p_provider_response: data,
          });
          if (error) throw error;
        }
      }
      await markProcessed();
      return json({ received: true, refundId, status });
    }

    await markProcessed();
    return json({ received: true, ignored: true, event: name });
  } catch (error) {
    logProviderError('payment-webhook failed', error);
    // Returning 500 lets MyFatoorah retry (max 5 attempts).
    return json({ error: 'server_error' }, 500);
  }
});
