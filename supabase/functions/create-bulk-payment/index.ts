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
import { createInvoiceForOrder, InvoiceError } from '../_shared/invoices.ts';

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

    const config = await mfConfig();
    if (!config.apiKey || !config.appPublicUrl) {
      return json({ error: 'payment_provider_not_configured' }, 503);
    }

    try {
      const invoice = await createInvoiceForOrder(admin, {
        orderId: checkoutOrderId,
        reference,
        customerName: userData.user.email || 'Bulk buyer',
        customerEmail: userData.user.email,
        language: body.language,
        callbackUrl: `${config.appPublicUrl}/api/merchant-payment/callback?order=${checkoutOrderId}`,
        errorUrl: `${config.appPublicUrl}/api/merchant-payment/callback?order=${checkoutOrderId}&failed=1`,
        webhookUrl: `${supabaseUrl}/functions/v1/payment-webhook`,
      });
      return json({
        checkoutOrderId,
        invoiceId: invoice.invoiceId,
        paymentUrl: invoice.invoiceUrl,
        bulkOrderIds: (checkout as any).bulkOrderIds ?? [],
      });
    } catch (error) {
      await admin.from('orders').update({ status: 'failed', payment_status: 'failed' }).eq('id', checkoutOrderId);
      await admin
        .from('bulk_orders')
        .update({ status: 'failed', payment_status: 'failed' })
        .eq('checkout_order_id', checkoutOrderId);
      if (error instanceof InvoiceError) {
        console.error('create-bulk-payment failed', error.code, error.message);
        const conflict = ['supplier_not_ready', 'supplier_not_active', 'payments_not_enabled'].includes(error.code);
        return json({ error: error.code }, conflict ? 409 : 502);
      }
      throw error;
    }
  } catch (error) {
    console.error('create-bulk-payment failed', String(error));
    return json({ error: 'server_error' }, 500);
  }
});
