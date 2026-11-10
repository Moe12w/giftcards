// supabase/functions/create-payment/index.ts
// Creates an order and a MyFatoorah invoice with the vendor as a supplier.
// Secrets come from Edge Function environment variables only.
//
// Required env:
//   MYFATOORAH_API_KEY       (secret API key)
//   MYFATOORAH_BASE_URL      (e.g. https://apitest.myfatoorah.com or https://api.myfatoorah.com)
//   APP_PUBLIC_URL           (return/error URLs)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';

interface Body {
  offerId: string;
  amountMinor: number;
  recipientName: string;
  recipientEmail: string;
  recipientPhone?: string;
  message?: string;
  language?: 'en' | 'ar';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Identify the caller from their JWT.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
    const buyerId = userData.user.id;

    const body = (await req.json()) as Body;
    if (!body.offerId || !Number.isInteger(body.amountMinor) || body.amountMinor <= 0) {
      return json({ error: 'invalid_request' }, 400);
    }
    if (!body.recipientName?.trim() || !body.recipientEmail?.trim()) {
      return json({ error: 'invalid_request' }, 400);
    }

    const admin = adminClient();

    // Load offer + vendor.
    const { data: offer, error: offerError } = await admin
      .from('offers')
      .select('*, vendor:vendors(*)')
      .eq('id', body.offerId)
      .maybeSingle();
    if (offerError) throw offerError;
    if (!offer || !offer.is_active) return json({ error: 'offer_unavailable' }, 404);

    const vendor = offer.vendor;
    if (!vendor || vendor.status !== 'approved') return json({ error: 'vendor_unavailable' }, 409);
    if (!vendor.myfatoorah_supplier_code) return json({ error: 'vendor_not_ready' }, 409);

    // Validate amount against the offer range.
    if (body.amountMinor < offer.min_amount_minor || body.amountMinor > offer.max_amount_minor) {
      return json({ error: 'invalid_amount' }, 400);
    }

    // Enforce the vendor's exposure limit: unredeemed balance + this sale
    // must not exceed max_unredeemed_minor.
    const { data: outstandingData, error: balanceError } = await admin.rpc(
      'vendor_outstanding_minor',
      { p_vendor_id: vendor.id },
    );
    if (balanceError) throw balanceError;
    const outstanding = Number(outstandingData ?? 0);
    if (outstanding + body.amountMinor > vendor.max_unredeemed_minor) {
      return json({ error: 'vendor_exposure_limit_reached' }, 409);
    }

    // Commission is computed server-side from the vendor's rate.
    const commissionMinor = Math.round((body.amountMinor * vendor.commission_bps) / 10_000);
    const vendorShareMinor = body.amountMinor - commissionMinor;
    const reference = crypto.randomUUID();

    // Create the pending order first.
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        buyer_id: buyerId,
        offer_id: offer.id,
        amount_minor: body.amountMinor,
        commission_minor: commissionMinor,
        vendor_share_minor: vendorShareMinor,
        status: 'pending',
        payment_reference: reference,
        recipient_name: body.recipientName,
        recipient_email: body.recipientEmail,
        recipient_phone: body.recipientPhone ?? null,
        gift_message: body.message ?? null,
        offer_snapshot: {
          title: offer.title,
          title_ar: offer.title_ar,
          vendor_name: vendor.name,
          vendor_name_ar: vendor.name_ar,
        },
      })
      .select('*')
      .single();
    if (orderError) throw orderError;

    const baseUrl = Deno.env.get('MYFATOORAH_BASE_URL') ?? 'https://apitest.myfatoorah.com';
    const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://example.com';

    // MyFatoorah SendPayment (V2). Amounts are major units here.
    const invoicePayload = {
      CustomerName: body.recipientName,
      NotificationOption: 'LNK',
      InvoiceValue: body.amountMinor / 100,
      DisplayCurrencyIso: 'QAR',
      Language: body.language === 'ar' ? 'AR' : 'EN',
      CustomerEmail: body.recipientEmail,
      CustomerReference: order.id,
      UserDefinedField: order.id,
      CallBackUrl: `${appUrl}/payment/success`,
      ErrorUrl: `${appUrl}/payment/error`,
      Suppliers: [
        {
          SupplierCode: Number(vendor.myfatoorah_supplier_code),
          InvoiceShare: body.amountMinor / 100,
        },
      ],
    };

    const mfResponse = await fetch(`${baseUrl}/v2/SendPayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('MYFATOORAH_API_KEY')}`,
        // Idempotency supported for /v3/payments; SendPayment is V2. We still
        // use our own unique reference to avoid duplicate orders.
        'Idempotency-Key': reference,
      },
      body: JSON.stringify(invoicePayload),
    });

    const mfJson = await mfResponse.json();
    if (!mfResponse.ok || !mfJson?.IsSuccess) {
      await admin.from('orders').update({ status: 'failed' }).eq('id', order.id);
      console.error('MyFatoorah error', mfJson);
      return json({ error: 'payment_provider_error' }, 502);
    }

    await admin
      .from('orders')
      .update({ provider_invoice_id: String(mfJson.Data.InvoiceId) })
      .eq('id', order.id);

    return json({
      orderId: order.id,
      invoiceId: mfJson.Data.InvoiceId,
      paymentUrl: mfJson.Data.InvoiceURL,
    });
  } catch (err) {
    console.error('create-payment failed', err);
    return json({ error: 'server_error' }, 500);
  }
});
