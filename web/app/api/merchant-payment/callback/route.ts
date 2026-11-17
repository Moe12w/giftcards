import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Browser return URL. It re-queries the provider through the same authoritative
 * confirmation route as the webhook, then sends the customer back to the app.
 * The redirect itself never marks an order paid.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('order') ?? '';
  const paymentId = url.searchParams.get('paymentId') ?? '';
  const failed = url.searchParams.get('failed') === '1';
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  const target = `${appUrl || '/'}${appUrl ? '/' : ''}`;

  if (failed || !orderId) {
    return NextResponse.redirect(`${target}?payment=failed${orderId ? `&order=${orderId}` : ''}`);
  }

  const internal = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data: payment } = await admin
      .from('myfatoorah_payments')
      .select('invoice_id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (payment?.invoice_id && internal) {
      const response = await fetch(`${appUrl}/api/merchant-payment/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': internal },
        body: JSON.stringify({ invoiceId: payment.invoice_id, paymentId }),
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      return NextResponse.redirect(
        `${target}?payment=${result.confirmed ? 'paid' : 'pending'}&order=${orderId}`,
      );
    }
  } catch (error) {
    console.error('[merchant-payment] callback confirmation failed', error);
  }

  return NextResponse.redirect(`${target}?payment=pending&order=${orderId}`);
}
