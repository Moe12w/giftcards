import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendClaimLinkEmail } from '@/lib/email';

/** Sends the claim link once for every voucher on a confirmed order. */
export async function deliverClaimLinks(orderId: string, claimToken: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, recipient_name, recipient_email, currency, total_minor, gift_message')
    .eq('id', orderId)
    .maybeSingle();
  if (!order?.recipient_email) return { delivered: false, reason: 'order_not_found' };

  const { data: vouchers } = await admin
    .from('vouchers')
    .select('id, delivery_status')
    .eq('order_id', orderId);
  if (!vouchers?.length) return { delivered: false, reason: 'voucher_not_found' };
  if (vouchers.every((voucher: any) => voucher.delivery_status === 'sent')) {
    return { delivered: false, reason: 'already_sent' };
  }

  const { data: item } = await admin
    .from('order_items')
    .select('products(title, title_ar)')
    .eq('order_id', orderId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  const product = Array.isArray(item?.products) ? item?.products[0] : item?.products;
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');

  const results = await Promise.all(
    vouchers.map((voucher: any) =>
      sendClaimLinkEmail({
        to: String(order.recipient_email),
        name: order.recipient_name,
        senderName: 'Giftly',
        title: String(product?.title ?? 'Gift card'),
        amountLabel: `${order.currency || 'QAR'} ${(Number(order.total_minor || 0) / 100).toFixed(2)}`,
        link: `${appUrl}/claim/${claimToken}`,
        appLink: `giftly://claim/${claimToken}`,
        message: order.gift_message,
      }),
    ),
  );

  if (results.some((result: any) => result?.delivered !== true)) {
    return { delivered: false, reason: 'email_provider_unavailable' };
  }

  await admin
    .from('vouchers')
    .update({ delivery_status: 'sent' })
    .in(
      'id',
      vouchers.map((voucher: any) => voucher.id),
    );
  return { delivered: true, count: vouchers.length };
}
