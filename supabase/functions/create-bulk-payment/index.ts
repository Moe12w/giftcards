// supabase/functions/create-bulk-payment/index.ts
// Creates one MyFatoorah invoice for a bulk buyer's cart. Each bulk offer is
// still its own bulk_order, but every vendor appears once in Suppliers[].
//
// Prices, quantities, tier rules, supplier readiness and allocations are all
// resolved by the bulk_checkout_create RPC — never from the client.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { mfConfig } from '../_shared/myfatoorah.ts';

interface Body {
  items: Array<{ offerId: string; quantity: number }>;
  idempotencyKey?: string;
  language?: 'en' | 'ar';
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

    const body = (await req.json()) as Body;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return json({ error: 'empty_cart' }, 400);
    }
    if (body.items.some((item) => !item.offerId || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      return json({ error: 'invalid_cart' }, 400);
    }

    // The RPC enforces buyer approval, offer visibility, tier pricing and
    // supplier readiness, and writes all orders atomically.
    const { data: checkout, error: checkoutError } = await userClient.rpc('bulk_checkout_create', {
      p_items: body.items,
      p_idempotency_key: body.idempotencyKey || null,
    });
    if (checkoutError) {
      const message = String(checkoutError.message ?? 'bulk_checkout_failed');
      const status = message.includes('supplier_not_ready') ? 409
        : message.includes('buyer_not_approved') ? 403
          : message.includes('offer_unavailable') || message.includes('invalid_quantity') ? 400
            : 502;
      return json({ error: message }, status);
    }

    const checkoutOrderId = String((checkout as any).checkoutOrderId ?? '');
    const reference = String((checkout as any).paymentReference ?? '');
    const admin = adminClient();

    if ((checkout as any).existing) {
      const { data: existingPayment } = await admin
        .from('myfatoorah_payments')
        .select('invoice_id, invoice_url')
        .eq('order_id', checkoutOrderId)
        .maybeSingle();
      return json({
        checkoutOrderId,
        invoiceId: existingPayment?.invoice_id ?? null,
        paymentUrl: existingPayment?.invoice_url ?? null,
        existing: true,
      });
    }

    const suppliers = Array.isArray((checkout as any).suppliers) ? (checkout as any).suppliers : [];
    if (suppliers.length === 0) return json({ error: 'no_suppliers' }, 409);

    const config = await mfConfig();
    if (!config.apiKey || !config.appPublicUrl) {
      return json({ error: 'payment_provider_not_configured' }, 503);
    }

    const payload: Record<string, unknown> = {
      CustomerName: userData.user.email || 'Bulk buyer',
      NotificationOption: 'LNK',
      InvoiceValue: Number((Number((checkout as any).totalMinor) / 100).toFixed(2)),
      DisplayCurrencyIso: 'QAR',
      Language: body.language === 'ar' ? 'AR' : 'EN',
      CustomerEmail: userData.user.email,
      CustomerReference: reference,
      UserDefinedField: checkoutOrderId,
      CallBackUrl: `${config.appPublicUrl}/api/merchant-payment/callback?order=${checkoutOrderId}`,
      ErrorUrl: `${config.appPublicUrl}/api/merchant-payment/callback?order=${checkoutOrderId}&failed=1`,
      WebhookUrl: `${supabaseUrl}/functions/v1/payment-webhook`,
      Suppliers: suppliers.map((supplier: any) => ({
        SupplierCode: Number(supplier.SupplierCode),
        InvoiceShare: Number((Number(supplier.InvoiceShareMinor) / 100).toFixed(2)),
      })),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/v2/SendPayment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const provider = await response.json().catch(() => null);
    const invoiceId = provider?.Data?.InvoiceId;
    const invoiceUrl = provider?.Data?.InvoiceURL;
    const ok = response.ok && (provider?.IsSuccess === true || String(provider?.IsSuccess).toLowerCase() === 'true');
    if (!ok || !invoiceId || !invoiceUrl) {
      await admin.from('orders').update({ status: 'failed', payment_status: 'failed' }).eq('id', checkoutOrderId);
      await admin
        .from('bulk_orders')
        .update({ status: 'failed', payment_status: 'failed' })
        .eq('checkout_order_id', checkoutOrderId);
      console.error('bulk SendPayment failed', String(provider?.Message ?? response.status));
      return json({ error: 'payment_provider_error' }, 502);
    }

    const { error: recordError } = await admin.rpc('myfatoorah_payment_recorded', {
      p_order_id: checkoutOrderId,
      p_invoice_id: String(invoiceId),
      p_invoice_url: String(invoiceUrl),
      p_payment_url: String(invoiceUrl),
      p_supplier_code: String(suppliers[0]?.SupplierCode ?? ''),
      p_provider_response: provider?.Data ?? {},
    });
    if (recordError) throw recordError;

    return json({
      checkoutOrderId,
      invoiceId: String(invoiceId),
      paymentUrl: String(invoiceUrl),
      bulkOrderIds: (checkout as any).bulkOrderIds ?? [],
    });
  } catch (error) {
    console.error('create-bulk-payment failed', String(error));
    return json({ error: 'server_error' }, 500);
  }
});
