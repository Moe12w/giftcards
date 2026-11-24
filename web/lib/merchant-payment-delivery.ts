import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendClaimLinkEmail } from '@/lib/email';
import type { VoucherClaim } from '@/lib/claim-links';

/** Sends each voucher its own claim link on a confirmed order. */
export async function deliverClaimLinks(orderId: string, claims: VoucherClaim[]) {
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

  const sent = new Set(vouchers.filter((v: any) => v.delivery_status === 'sent').map((v: any) => v.id));
  const pending = claims.filter((claim) => sent.has(claim.voucherId) === false);
  if (pending.length === 0) return { delivered: false, reason: 'already_sent' };

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
    pending.map((claim) =>
      sendClaimLinkEmail({
        to: String(order.recipient_email),
        name: order.recipient_name,
        senderName: 'Marajukoo',
        title: String(product?.title ?? 'Gift card'),
        amountLabel: `${order.currency || 'QAR'} ${(Number(order.total_minor || 0) / 100).toFixed(2)}`,
        link: `${appUrl}/claim/${claim.claimToken}`,
        appLink: `giftly://claim/${claim.claimToken}`,
        message: order.gift_message,
      }).then((result) => ({ result, voucherId: claim.voucherId })),
    ),
  );

  if (results.some(({ result }: any) => result?.delivered !== true)) {
    return { delivered: false, reason: 'email_provider_unavailable' };
  }

  await admin
    .from('vouchers')
    .update({ delivery_status: 'sent' })
    .in('id', results.map(({ voucherId }: any) => voucherId));
  return { delivered: true, count: results.length };
}
