// supabase/functions/payment-webhook/index.ts
// Receives MyFatoorah PAYMENT_STATUS_CHANGED events.
//
// Safety:
//  - Verifies the MyFatoorah-Signature header (HMAC-SHA256, base64).
//  - Records every event in payment_events with a unique event id.
//  - Fulfilment is idempotent: a duplicate PAID event never issues two cards.
//  - Raw card/claim codes are never logged.
//
// Required env:
//   MYFATOORAH_WEBHOOK_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { adminClient, randomToken, sha256Hex } from '../_shared/clients.ts';
import { json } from '../_shared/cors.ts';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacBase64(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function signaturePayload(data: any): string {
  const v = (x: unknown) => (x === null || x === undefined ? '' : String(x));
  return [
    `Invoice.Id=${v(data?.Invoice?.Id)}`,
    `Invoice.Status=${v(data?.Invoice?.Status)}`,
    `Transaction.Status=${v(data?.Transaction?.Status)}`,
    `Transaction.PaymentId=${v(data?.Transaction?.PaymentId)}`,
    `Invoice.ExternalIdentifier=${v(data?.Invoice?.ExternalIdentifier)}`,
  ].join(',');
}

/** Replace with a real email provider (e.g. Resend) in production. */
async function deliverClaimLink(email: string, claimUrl: string): Promise<void> {
  // TODO: send the claim link by email. Never log the URL/token.
  console.info('claim link queued for delivery to recipient');
  void email;
  void claimUrl;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const raw = await req.text();
    const event = JSON.parse(raw);

    // 1. Verify signature.
    const secret = Deno.env.get('MYFATOORAH_WEBHOOK_SECRET');
    if (secret) {
      const header = req.headers.get('myfatoorah-signature') ?? '';
      const expected = await hmacBase64(secret, signaturePayload(event.Data));
      if (!timingSafeEqual(header, expected)) {
        return json({ error: 'invalid_signature' }, 401);
      }
    }

    if (event?.Event?.Name !== 'PAYMENT_STATUS_CHANGED') {
      return json({ received: true, ignored: true });
    }

    const data = event.Data;
    const invoiceId = String(data?.Invoice?.Id ?? '');
    const invoiceStatus = String(data?.Invoice?.Status ?? '');
    const txStatus = String(data?.Transaction?.Status ?? '');
    const eventId = String(event?.Event?.Reference ?? `${invoiceId}:${invoiceStatus}:${txStatus}`);

    const admin = adminClient();

    // 2. Record the event (idempotency log). Duplicate event ids are ignored.
    const { error: eventError } = await admin
      .from('payment_events')
      .upsert(
        {
          provider: 'myfatoorah',
          event_id: eventId,
          payload: event,
        },
        { onConflict: 'event_id', ignoreDuplicates: true },
      );
    if (eventError) throw eventError;

    if (invoiceStatus !== 'PAID' || txStatus !== 'SUCCESS') {
      // Refunds/failures: MyFatoorah handles the money; we only update status.
      if (invoiceStatus === 'REFUNDED') {
        await admin
          .from('orders')
          .update({ status: 'refunded' })
          .eq('provider_invoice_id', invoiceId);
      }
      await admin
        .from('payment_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('event_id', eventId);
      return json({ received: true });
    }

    // 3. Fulfil atomically. Generate secrets in memory; store only hashes.
    const claimToken = randomToken(32); // 64 hex chars
    const cardCode = randomToken(24);
    const claimTokenHash = await sha256Hex(claimToken);
    const cardCodeHash = await sha256Hex(cardCode);

    const { data: cardId, error: fulfilError } = await admin.rpc('fulfill_order', {
      p_provider_invoice_id: invoiceId,
      p_claim_token_hash: claimTokenHash,
      p_card_code_hash: cardCodeHash,
    });
    if (fulfilError) throw fulfilError;

    // 4. Deliver the claim link. The raw token exists only here.
    const { data: card } = await admin
      .from('gift_cards')
      .select('recipient_email, order_id')
      .eq('id', cardId)
      .maybeSingle();

    const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://example.com';
    if (card?.recipient_email) {
      await deliverClaimLink(card.recipient_email, `${appUrl}/claim/${claimToken}`);
    }

    await admin
      .from('payment_events')
      .update({ order_id: card?.order_id ?? null, processed_at: new Date().toISOString() })
      .eq('event_id', eventId);

    return json({ received: true, cardId });
  } catch (err) {
    console.error('payment-webhook failed', err);
    return json({ error: 'server_error' }, 500);
  }
});
