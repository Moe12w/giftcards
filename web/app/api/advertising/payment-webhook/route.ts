import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

interface PaymentWebhookBody {
  campaign_id?: string;
  provider?: string;
  provider_reference?: string;
  amount_minor?: number | string;
  currency?: string;
  event?: string;
  status?: string;
}

const SUCCEEDED_EVENTS = new Set([
  'payment.succeeded',
  'payment.captured',
  'charge.succeeded',
  'charge.captured',
]);

const SUCCEEDED_STATUSES = new Set(['succeeded', 'paid', 'captured', 'success']);

function signatureMatches(rawBody: string, header: string, secret: string): boolean {
  const provided = header.replace(/^sha256=/i, '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const providedBuffer = Buffer.from(provided, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

/**
 * Server-to-server advertising payment webhook.
 *
 * A payment gateway (or an internal payment service) posts a signed event when
 * an advertising payment succeeds. The signature is verified against
 * ADVERTISING_PAYMENT_WEBHOOK_SECRET before the service-role client confirms
 * the payment. The browser never gets to mark a campaign as paid.
 *
 * Headers: `x-advertising-signature: sha256=<hex hmac>` (or `x-signature`)
 * Body:    { campaign_id, provider, provider_reference, amount_minor, event }
 *
 * The database function is idempotent: replaying the same event returns
 * already_paid instead of charging twice or duplicating the ledger entry.
 */
export async function POST(request: Request) {
  const secret = process.env.ADVERTISING_PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Advertising payment webhook is not configured' },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get('x-advertising-signature') ?? request.headers.get('x-signature') ?? '';
  if (!signature || !signatureMatches(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: PaymentWebhookBody;
  try {
    body = JSON.parse(rawBody) as PaymentWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Gateways often send other events on the same endpoint. Acknowledge them so
  // the provider stops retrying, but never touch the campaign.
  if (body.event && !SUCCEEDED_EVENTS.has(body.event.toLowerCase())) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'event_not_a_payment' });
  }
  if (body.status && !SUCCEEDED_STATUSES.has(body.status.toLowerCase())) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'status_not_succeeded' });
  }

  const campaignId = body.campaign_id?.trim();
  const reference = body.provider_reference?.trim();
  const amountMinor = Number(body.amount_minor);

  if (!campaignId) {
    return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
  }
  if (!reference) {
    return NextResponse.json({ error: 'provider_reference is required' }, { status: 400 });
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return NextResponse.json({ error: 'amount_minor must be a positive integer' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('advertising_confirm_payment', {
      p_campaign_id: campaignId,
      p_provider: body.provider?.trim() || 'webhook',
      p_provider_reference: reference,
      p_amount_minor: amountMinor,
      p_raw_payload: {
        source: 'advertising_payment_webhook',
        event: body.event ?? null,
        status: body.status ?? null,
        currency: body.currency ?? null,
      },
    });

    if (error) {
      const message = error.message ?? 'Could not confirm advertising payment';
      const status = message.includes('campaign_not_found')
        ? 404
        : message.includes('payment_reference_already_used') ||
            message.includes('campaign_not_payable')
          ? 409
          : message.includes('amount_below_quote')
            ? 422
            : 500;
      console.error('Advertising payment webhook error:', message);
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (err) {
    console.error('Advertising payment webhook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
