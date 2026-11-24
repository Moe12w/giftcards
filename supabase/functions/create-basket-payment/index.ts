// supabase/functions/create-basket-payment/index.ts
// Creates one MyFatoorah invoice for a group-basket contribution. The prices
// are re-read from our database; the client only says which product and how
// much. On confirmation the paid lines are copied into the basket by
// basket_fulfill_from_payment(), so nothing reaches the shared box unpaid.
//
// Env: MYFATOORAH_API_KEY, MYFATOORAH_BASE_URL, APP_PUBLIC_URL,
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient, sha256Hex } from '../_shared/clients.ts';
import { mfConfig } from '../_shared/myfatoorah.ts';
import { createInvoiceForOrder, InvoiceError } from '../_shared/invoices.ts';

interface ContributionLine {
  productId: string;
  amountMinor: number;
}

interface Body {
  basketId: string;
  items: ContributionLine[];
  language?: 'en' | 'ar';
  idempotencyKey?: string;
  returnUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
    const buyerId = userData.user.id;

    const body = (await req.json()) as Body;
    const basketId = String(body.basketId ?? '').trim();
    const lines = Array.isArray(body.items) ? body.items : [];
    if (!basketId || lines.length === 0) return json({ error: 'invalid_request' }, 400);

    const admin = adminClient();

    const { data: basket, error: basketError } = await admin
      .from('gift_baskets')
      .select('id, status, recipient_name')
      .eq('id', basketId)
      .maybeSingle();
    if (basketError) throw basketError;
    if (!basket) return json({ error: 'basket_not_found' }, 404);
    if (basket.status !== 'open') return json({ error: 'basket_closed' }, 409);

    const { data: participant, error: participantError } = await admin
      .from('gift_basket_participants')
      .select('user_id')
      .eq('basket_id', basketId)
      .eq('user_id', buyerId)
      .maybeSingle();
    if (participantError) throw participantError;
    if (!participant) return json({ error: 'not_a_participant' }, 403);

    const productIds = [...new Set(lines.map((line) => String(line.productId ?? '')))];
    if (productIds.some((id) => !id)) return json({ error: 'invalid_request' }, 400);

    const { data: products, error: productsError } = await admin
      .from('products')
      .select(
        'id, vendor_id, partner_id, enterprise_product_id, min_amount_minor, max_amount_minor, is_active, currency, title, title_ar, fulfilment_type',
      )
      .in('id', productIds);
    if (productsError) throw productsError;

    const byId = new Map<string, any>((products ?? []).map((product: any) => [product.id, product]));
    const prepared: Array<{ product: any; amountMinor: number }> = [];
    let totalMinor = 0;
    let currency = 'QAR';

    for (const line of lines) {
      const product = byId.get(String(line.productId));
      if (!product?.is_active || (!product.vendor_id && !product.partner_id)) {
        return json({ error: 'product_unavailable' }, 404);
      }
      const amount = Number(line.amountMinor ?? 0);
      if (!Number.isInteger(amount) || amount <= 0) return json({ error: 'invalid_amount' }, 400);
      const min = Number(product.min_amount_minor ?? 0);
      const max = Number(product.max_amount_minor ?? 0);
      if (min > 0 && amount < min) return json({ error: 'invalid_amount' }, 400);
      if (max > 0 && amount > max) return json({ error: 'invalid_amount' }, 400);
      prepared.push({ product, amountMinor: amount });
      totalMinor += amount;
      currency = product.currency || currency;
    }

    // Idempotency: one order per (buyer, basket, client key).
    const idempotencyKey = String(body.idempotencyKey ?? '').trim();
    const reference = idempotencyKey
      ? `gb:${await sha256Hex(`${buyerId}:${basketId}:${idempotencyKey}`)}`
      : `gb:${crypto.randomUUID()}`;
    const { data: existingOrder } = await admin
      .from('orders')
      .select('id')
      .eq('payment_reference', reference)
      .maybeSingle();
    if (existingOrder) {
      const { data: existingPayment } = await admin
        .from('myfatoorah_payments')
        .select('invoice_id, invoice_url')
        .eq('order_id', existingOrder.id)
        .maybeSingle();
      return json({
        orderId: existingOrder.id,
        invoiceId: existingPayment?.invoice_id ?? null,
        paymentUrl: existingPayment?.invoice_url ?? null,
        existing: true,
      });
    }

    const orderRef = `GB-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        buyer_id: buyerId,
        basket_id: basketId,
        order_ref: orderRef,
        currency,
        subtotal_minor: totalMinor,
        fee_minor: 0,
        total_minor: totalMinor,
        status: 'pending',
        payment_status: 'unpaid',
        payment_provider: 'myfatoorah',
        payment_reference: reference,
        recipient_name: basket.recipient_name,
      })
      .select('id')
      .single();
    if (orderError) throw orderError;

    const { error: itemError } = await admin.from('order_items').insert(
      prepared.map(({ product, amountMinor }) => ({
        order_id: order.id,
        product_id: product.id,
        enterprise_product_id: product.enterprise_product_id,
        vendor_id: product.vendor_id,
        quantity: 1,
        unit_price_minor: amountMinor,
        total_minor: amountMinor,
        commission_minor: 0,
        vendor_share_minor: amountMinor,
        currency: product.currency || currency,
        recipient_name: basket.recipient_name,
      })),
    );
    if (itemError) {
      await admin.from('orders').delete().eq('id', order.id);
      // The exposure trigger (0138) serialises the check on the vendor row.
      if (String(itemError.message ?? '').includes('vendor_exposure_limit_reached')) {
        return json({ error: 'vendor_exposure_limit_reached' }, 409);
      }
      throw itemError;
    }

    const config = await mfConfig();
    const appUrl = config.appPublicUrl;
    if (!config.apiKey || !appUrl) {
      await admin.from('orders').update({ status: 'failed', payment_status: 'failed' }).eq('id', order.id);
      return json({ error: 'payment_provider_not_configured' }, 503);
    }

    const requestedReturn = String(body.returnUrl ?? '').trim();
    const trustedReturn =
      requestedReturn.startsWith('tazella://') ||
      requestedReturn === config.appPublicUrl ||
      requestedReturn.startsWith(`${config.appPublicUrl}/`);
    const returnTo = trustedReturn ? `&return_to=${encodeURIComponent(requestedReturn)}` : '';

    try {
      const invoice = await createInvoiceForOrder(admin, {
        orderId: order.id,
        reference: order.id,
        customerName: basket.recipient_name || 'Tazella customer',
        customerEmail: userData.user.email ?? undefined,
        language: body.language,
        callbackUrl: `${appUrl}/api/merchant-payment/callback?order=${order.id}${returnTo}`,
        errorUrl: `${appUrl}/api/merchant-payment/callback?order=${order.id}&failed=1${returnTo}`,
        webhookUrl: `${supabaseUrl}/functions/v1/payment-webhook`,
      });
      return json({
        orderId: order.id,
        invoiceId: invoice.invoiceId,
        paymentUrl: invoice.invoiceUrl,
      });
    } catch (error) {
      await admin
        .from('orders')
        .update({ status: 'failed', payment_status: 'failed' })
        .eq('id', order.id);
      if (error instanceof InvoiceError) {
        console.error('create-basket-payment failed', error.code, error.message);
        const conflict = ['supplier_not_ready', 'supplier_not_active', 'payments_not_enabled'].includes(error.code);
        return json({ error: error.code }, conflict ? 409 : 502);
      }
      throw error;
    }
  } catch (error) {
    console.error('create-basket-payment failed', String(error));
    return json({ error: 'server_error' }, 500);
  }
});
