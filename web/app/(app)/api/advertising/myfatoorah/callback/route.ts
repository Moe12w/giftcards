import { NextResponse } from 'next/server';
import { getAppPublicUrl } from '@/lib/myfatoorah';
import { confirmMyFatoorahAdvertisingPayment } from '@/lib/advertising-payments';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Browser return URL for advertising card payments.
 *
 * A redirect proves nothing on its own: the payment is re-read from MyFatoorah
 * on the server, and the campaign is only marked paid from that response. The
 * webhook does the same, so a closed browser never loses a payment.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get('paymentId') ?? url.searchParams.get('PaymentId');
  const invoiceId =
    url.searchParams.get('Id') ??
    url.searchParams.get('id') ??
    url.searchParams.get('invoiceId') ??
    url.searchParams.get('InvoiceId');
  const failed = url.searchParams.get('failed') === '1';
  const surface = url.searchParams.get('surface') === 'enterprise' ? 'enterprise' : 'vendor';

  const base = (await getAppPublicUrl()) || url.origin;

  let result: Awaited<ReturnType<typeof confirmMyFatoorahAdvertisingPayment>> | null = null;
  if (!failed) {
    try {
      result = await confirmMyFatoorahAdvertisingPayment({
        paymentId,
        invoiceId,
        source: 'callback',
        surface,
      });
    } catch (error) {
      console.error('[advertising] callback failed', error);
    }
  }

  const home = result?.surface === 'enterprise' ? '/enterprise/advertising' : '/vendor/advertising';

  if (result?.campaignId) {
    if (result.paid) {
      return NextResponse.redirect(`${base}${home}/campaigns/${result.campaignId}?paid=1`, 303);
    }
    const message = failed
      ? 'Payment was cancelled before it completed. You can try again from checkout.'
      : 'The payment has not been confirmed yet. Refresh in a moment or try again.';
    return NextResponse.redirect(
      `${base}${home}/checkout/${result.campaignId}?error=${encodeURIComponent(message)}`,
      303,
    );
  }

  const message = failed
    ? 'Payment was cancelled before it completed.'
    : 'We could not match that payment to a campaign. If you were charged, contact support with your payment reference.';
  return NextResponse.redirect(`${base}${home}?error=${encodeURIComponent(message)}`, 303);
}
