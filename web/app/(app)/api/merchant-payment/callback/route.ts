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
  // The internal confirm call carries the service-role key, so its destination
  // must be a trusted constant. Never derive it from the request's Host/origin.
  const configuredAppUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const appUrl = configuredAppUrl ? configuredAppUrl.replace(/\/+$/, '') : '';
  const target = `${appUrl || url.origin}/`;

  // A mobile checkout passes its app scheme here; the browser closes itself
  // when MyFatoorah follows this redirect. Never trust an arbitrary URL.
  const requestedReturn = url.searchParams.get('return_to') ?? '';
  const returnTo =
    requestedReturn.startsWith('tazella://') ||
    (appUrl && (requestedReturn === appUrl || requestedReturn.startsWith(`${appUrl}/`)))
      ? requestedReturn
      : '';
  const finish = (status: string) => {
    const query = `payment=${status}${orderId ? `&order=${orderId}` : ''}`;
    if (returnTo) {
      const separator = returnTo.includes('?') ? '&' : '?';
      return NextResponse.redirect(`${returnTo}${separator}${query}`);
    }
    return NextResponse.redirect(`${target}${query}`);
  };

  if (failed || !orderId) return finish('failed');

  const internal = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data: payment } = await admin
      .from('myfatoorah_payments')
      .select('invoice_id')
      .eq('order_id', orderId)
      .maybeSingle();

    // Without a configured site URL there is no safe destination for the
    // secret-bearing request; skip confirmation rather than send it anywhere
    // derived from the incoming request.
    if (payment?.invoice_id && internal && appUrl) {
      const response = await fetch(`${appUrl}/api/merchant-payment/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': internal },
        body: JSON.stringify({ invoiceId: payment.invoice_id, paymentId }),
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      return finish(result.confirmed ? 'paid' : 'pending');
    }
  } catch (error) {
    console.error('[merchant-payment] callback confirmation failed', error);
  }

  return finish('pending');
}
