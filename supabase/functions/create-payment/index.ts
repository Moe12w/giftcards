// supabase/functions/create-payment/index.ts
// Creates a gift-card order from a verified customer JWT, then asks MyFatoorah
// for a hosted payment linked to the selling vendor's supplier.
//
// Security / correctness:
//  - The price is taken from our database, never trusted from the client.
//  - SupplierCode and amount allocation are resolved server-side.
//  - Provider-managed commission: no ProposedShare / ProposedDepositShare.
//  - A client idempotency key prevents duplicate orders/invoices.
//
// Env: MYFATOORAH_API_KEY, MYFATOORAH_BASE_URL, APP_PUBLIC_URL,
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient, sha256Hex } from '../_shared/clients.ts';
import { mfConfig } from '../_shared/myfatoorah.ts';
import { createInvoiceForOrder, InvoiceError } from '../_shared/invoices.ts';

interface Body {
  productId: string;
  variantId?: string | null;
  amountMinor?: number;
  recipientName: string;
  recipientEmail: string;
  recipientPhone?: string;
  message?: string;
  language?: 'en' | 'ar';
  idempotencyKey?: string;
  /** Deep link MyFatoorah returns to after payment (mobile app only). */
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
    if (!body.productId || !body.recipientName?.trim() || !body.recipientEmail?.trim()) {
      return json({ error: 'invalid_request' }, 400);
    }

    const admin = adminClient();

    // Price and vendor come from our database. A variant fixes the price; an
    // open-value product accepts an amount only inside the product's range.
    const { data: product, error: productError } = await admin
      .from('products')
      .select('id, vendor_id, partner_id, enterprise_product_id, min_amount_minor, max_amount_minor, is_active, currency, title, title_ar, fulfilment_type')
      .eq('id', body.productId)
      .maybeSingle();
    if (productError) throw productError;
    if (!product?.is_active || (!product.vendor_id && !product.partner_id)) {
      return json({ error: 'product_unavailable' }, 404);
    }

    let unitPriceMinor = 0;
    let variantId: string | null = null;
    if (body.variantId) {
      const { data: variant, error: variantError } = await admin
        .from('product_variants')
        .select('id, product_id, price_minor, amount_minor, active')
        .eq('id', body.variantId)
        .eq('product_id', body.productId)
        .maybeSingle();
      if (variantError) throw variantError;
      if (!variant || variant.active === false) return json({ error: 'variant_unavailable' }, 404);
      unitPriceMinor = Number(variant.price_minor ?? variant.amount_minor ?? 0);
      variantId = variant.id;
    } else {
      unitPriceMinor = Number(body.amountMinor ?? 0);
      const min = Number(product.min_amount_minor ?? 0);
      const max = Number(product.max_amount_minor ?? 0);
      if (!Number.isInteger(unitPriceMinor) || unitPriceMinor <= 0) {
        return json({ error: 'invalid_amount' }, 400);
      }
      if (min > 0 && unitPriceMinor < min) return json({ error: 'invalid_amount' }, 400);
      if (max > 0 && unitPriceMinor > max) return json({ error: 'invalid_amount' }, 400);
    }
    if (!Number.isInteger(unitPriceMinor) || unitPriceMinor <= 0) {
      return json({ error: 'invalid_amount' }, 400);
    }

    // Vendors and enterprise partners use the identical supplier model.
    let ownerName = '';
    let supplierCode: string | null = null;
    // Captured from the owner row we already fetch below, so the supplier-status
    // and eligibility gates don't re-query the same table twice.
    let ownerSupplierStatus: string | null = null;
    let ownerPaymentEligible = false;
    if (product.vendor_id) {
      const { data: vendor, error: vendorError } = await admin
        .from('vendors')
        .select('id, name, status, myfatoorah_supplier_code, myfatoorah_supplier_status, payment_eligibility, max_unredeemed_minor')
        .eq('id', product.vendor_id)
        .maybeSingle();
      if (vendorError) throw vendorError;
      if (!vendor || vendor.status !== 'approved') return json({ error: 'vendor_unavailable' }, 409);
      supplierCode = vendor.myfatoorah_supplier_code;
      ownerName = vendor.name;
      ownerSupplierStatus = vendor.myfatoorah_supplier_status ?? null;
      ownerPaymentEligible = Boolean(vendor.payment_eligibility);
      const exposureLimit = Number(vendor.max_unredeemed_minor ?? 0);
      if (exposureLimit > 0) {
        const { data: outstandingData, error: outstandingError } = await admin.rpc(
          'vendor_outstanding_minor', { p_vendor_id: vendor.id },
        );
        if (outstandingError) throw outstandingError;
        if (Number(outstandingData ?? 0) + unitPriceMinor > exposureLimit) {
          return json({ error: 'vendor_exposure_limit_reached' }, 409);
        }
      }
    } else {
      const { data: partner, error: partnerError } = await admin
        .from('enterprise_partners')
        .select('id, name, status, myfatoorah_supplier_code, myfatoorah_supplier_status, payment_eligibility')
        .eq('id', product.partner_id)
        .maybeSingle();
      if (partnerError) throw partnerError;
      if (!partner || partner.status !== 'active') return json({ error: 'vendor_unavailable' }, 409);
      supplierCode = partner.myfatoorah_supplier_code;
      ownerName = partner.name;
      ownerSupplierStatus = partner.myfatoorah_supplier_status ?? null;
      ownerPaymentEligible = Boolean(partner.payment_eligibility);
    }

    if (!supplierCode) return json({ error: 'supplier_not_ready' }, 409);
    if (String(ownerSupplierStatus ?? '').toLowerCase() !== 'active') {
      return json({ error: 'supplier_not_active' }, 409);
    }
    if (!ownerPaymentEligible) return json({ error: 'payments_not_enabled' }, 409);

    // Idempotency: one order per (buyer, client key).
    const idempotencyKey = String(body.idempotencyKey ?? '').trim();
    const reference = idempotencyKey
      ? `gc:${await sha256Hex(`${buyerId}:${idempotencyKey}`)}`
      : `gc:${crypto.randomUUID()}`;
    const { data: existingOrder } = await admin
      .from('orders')
      .select('id, order_ref')
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

    const currency = product.currency || 'QAR';
    const orderRef = `GC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        buyer_id: buyerId,
        order_ref: orderRef,
        currency,
        subtotal_minor: unitPriceMinor,
        fee_minor: 0,
        total_minor: unitPriceMinor,
        status: 'pending',
        payment_status: 'unpaid',
        payment_provider: 'myfatoorah',
        payment_reference: reference,
        recipient_name: body.recipientName.trim(),
        recipient_email: body.recipientEmail.trim(),
        recipient_phone: body.recipientPhone?.trim() || null,
        gift_message: body.message?.trim() || null,
        offer_snapshot: {
          title: product.title,
          title_ar: product.title_ar,
          vendor_name: ownerName,
          fulfilment_type: product.fulfilment_type,
        },
      })
      .select('id')
      .single();
    if (orderError) throw orderError;

    const { error: itemError } = await admin.from('order_items').insert({
      order_id: order.id,
      product_id: product.id,
      product_variant_id: variantId,
      enterprise_product_id: product.enterprise_product_id,
      vendor_id: product.vendor_id,
      quantity: 1,
      unit_price_minor: unitPriceMinor,
      total_minor: unitPriceMinor,
      // Provider-managed commission: no separate platform deduction here.
      commission_minor: 0,
      vendor_share_minor: unitPriceMinor,
      currency,
      recipient_name: body.recipientName.trim(),
      recipient_email: body.recipientEmail.trim(),
      recipient_phone: body.recipientPhone?.trim() || null,
      gift_message: body.message?.trim() || null,
    });
    if (itemError) {
      await admin.from('orders').delete().eq('id', order.id);
      // The exposure trigger (0138) is the authoritative check: it serialises on
      // the vendor row, so it is the last word on whether this order fits.
      if (String(itemError.message ?? '').includes('vendor_exposure_limit_reached')) {
        return json({ error: 'vendor_exposure_limit_reached' }, 409);
      }
      throw itemError;
    }

    const config = await mfConfig();
    const appUrl = config.appPublicUrl;
    // Only allow our own app scheme or the configured site as a return target.
    const requestedReturn = String(body.returnUrl ?? '').trim();
    const trustedReturn =
      requestedReturn.startsWith('tazilla://') ||
      requestedReturn === config.appPublicUrl ||
      requestedReturn.startsWith(`${config.appPublicUrl}/`);
    const returnTo = trustedReturn && config.appPublicUrl
      ? `&return_to=${encodeURIComponent(requestedReturn)}`
      : '';
    if (!config.apiKey || !appUrl) {
      await admin.from('orders').update({ status: 'failed', payment_status: 'failed' }).eq('id', order.id);
      return json({ error: 'payment_provider_not_configured' }, 503);
    }

    try {
      const invoice = await createInvoiceForOrder(admin, {
        orderId: order.id,
        reference: order.id,
        customerName: body.recipientName.trim(),
        customerEmail: body.recipientEmail.trim(),
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
        console.error('create-payment failed', error.code, error.message);
        const conflict = ['supplier_not_ready', 'supplier_not_active', 'payments_not_enabled'].includes(error.code);
        return json({ error: error.code }, conflict ? 409 : 502);
      }
      throw error;
    }
  } catch (error) {
    console.error('create-payment failed', String(error));
    return json({ error: 'server_error' }, 500);
  }
});
