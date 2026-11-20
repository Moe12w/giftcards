import { NextResponse } from 'next/server';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPaymentMyFatoorahConfig, getMyFatoorahPaymentStatus } from '@/lib/myfatoorah';
import { deliverClaimLinks } from '@/lib/merchant-payment-delivery';
import { mapVoucherClaims } from '@/lib/claim-links';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Authoritative gift-card confirmation. Both the MyFatoorah webhook and the
 * browser return URL call this route, which always re-queries the provider.
 * A redirect alone can never issue a gift card.
 */
export async function POST(request: Request) {
  // The Edge Functions sign with INTERNAL_API_KEY when it is set (the name
  // Supabase does not reserve), while this route and the browser callback use
  // the service-role key. Accept either configured secret so a webhook is never
  // rejected just because the operator followed the recommended naming.
  const acceptedKeys = [process.env.INTERNAL_API_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  const provided = request.headers.get('x-internal-key') ?? '';
  const providedDigest = createHash('sha256').update(provided).digest();
  const authorized =
    provided.length > 0 &&
    acceptedKeys.some((key) => timingSafeEqual(createHash('sha256').update(key).digest(), providedDigest));
  if (!authorized) {
    if (acceptedKeys.length === 0) {
      console.error('[merchant-payment] no internal key configured: confirmation is impossible');
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      invoiceId?: string;
      paymentId?: string;
      eventPaymentId?: string;
    };
    const invoiceId = String(body.invoiceId ?? '').trim();
    if (!invoiceId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const admin = createAdminClient();
    const { data: payment } = await admin
      .from('myfatoorah_payments')
      .select('id, order_id, amount_minor, payment_status, payment_id')
      .eq('invoice_id', invoiceId)
      .maybeSingle();
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const key = String(body.paymentId || body.eventPaymentId || payment.payment_id || invoiceId);
    const keyType = body.paymentId || body.eventPaymentId || payment.payment_id ? 'PaymentId' : 'InvoiceId';
    const giftConfig = await getPaymentMyFatoorahConfig();
    const status = await getMyFatoorahPaymentStatus({ key, keyType }, giftConfig);

    if (!status.paid || Number(status.invoiceId) !== Number(invoiceId)) {
      return NextResponse.json({ confirmed: false, reason: 'payment_not_paid' });
    }
    if (status.amountMinor !== Number(payment.amount_minor)) {
      console.error('[merchant-payment] amount mismatch', {
        invoiceId,
        expected: payment.amount_minor,
        received: status.amountMinor,
      });
      return NextResponse.json({ confirmed: false, reason: 'amount_mismatch' });
    }

    // Bulk orders are fulfilled by the existing bulk-order flow (one voucher
    // per allocated slot, then the buyer assigns recipients). They must not go
    // through the single-item gift-card fulfilment path.
    const { data: bulkOrders } = await admin
      .from('bulk_orders')
      .select('id')
      .eq('checkout_order_id', payment.order_id)
      .limit(1);
    if (bulkOrders && bulkOrders.length > 0) {
      const { data: result, error: bulkError } = await admin.rpc('bulk_fulfill_from_payment', {
        p_checkout_order_id: payment.order_id,
      });
      if (bulkError) throw bulkError;
      return NextResponse.json({
        confirmed: true,
        bulk: true,
        orderId: payment.order_id,
        fulfilled: (result as any)?.fulfilled ?? 0,
        delivery: { delivered: false, reason: 'bulk_buyer_sends_links' },
      });
    }

    const raw = (status.raw ?? {}) as Record<string, any>;
    const { error: confirmError } = await admin.rpc('myfatoorah_payment_confirmed', {
      p_order_id: payment.order_id,
      p_payment_id: status.paymentId ?? key,
      p_provider_response: raw,
      p_suppliers: Array.isArray(raw.Suppliers) ? raw.Suppliers : null,
    });
    if (confirmError) throw confirmError;

    // Basket contributions put the paid cards into the shared box instead of
    // issuing a voucher to the payer. The RPC is idempotent per order line.
    const { data: orderRow } = await admin
      .from('orders')
      .select('basket_id')
      .eq('id', payment.order_id)
      .maybeSingle();
    if (orderRow?.basket_id) {
      const { data: fulfilled, error: basketError } = await admin.rpc(
        'basket_fulfill_from_payment',
        { p_order_id: payment.order_id },
      );
      if (basketError) throw basketError;
      return NextResponse.json({
        confirmed: true,
        basket: true,
        orderId: payment.order_id,
        added: (fulfilled as any)?.added ?? 0,
        delivery: { delivered: false, reason: 'basket_contribution' },
      });
    }

    const itemCount = await admin
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', payment.order_id);
    const count = itemCount.count ?? 0;
    const hashes = Array.from({ length: count }, () => {
      const claimToken = randomBytes(32).toString('hex');
      return {
        claimToken,
        claim_token_hash: createHash('sha256').update(claimToken).digest('hex'),
        card_code_hash: createHash('sha256').update(randomBytes(24)).digest('hex'),
      };
    });

    const { data: fulfilment, error: fulfilError } = await admin.rpc('myfatoorah_fulfill_order', {
      p_provider_invoice_id: invoiceId,
      p_hashes: hashes.map(({ claimToken: _token, ...hash }) => hash),
    });
    if (fulfilError) throw fulfilError;

    let delivery: { delivered: boolean; reason?: string; count?: number } = {
      delivered: false,
      reason: 'not_attempted',
    };
    const voucherIds = Array.isArray((fulfilment as any)?.voucher_ids)
      ? (fulfilment as any).voucher_ids.map(String)
      : [];
    const claims = mapVoucherClaims(voucherIds, hashes.map((hash) => hash.claimToken));
    if (claims.length > 0) {
      delivery = await deliverClaimLinks(payment.order_id, claims);
    }

    return NextResponse.json({
      confirmed: true,
      orderId: payment.order_id,
      voucherIds: (fulfilment as any)?.voucher_ids ?? [],
      alreadyFulfilled: Boolean((fulfilment as any)?.already_fulfilled),
      delivery,
    });
  } catch (error) {
    console.error('[merchant-payment] confirmation failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
