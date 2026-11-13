'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, claimUrl, appClaimUrl, emailProviderReady } from '@/lib/email';
import { unitPriceForQuantity, parseRecipientRows } from '@/lib/bulk';

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function makeOrderRef() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BULK-${y}${m}${day}-${rand}`;
}

export async function createBulkOrder(formData: FormData) {
  const ctx = await requireApprovedBusinessBuyer();
  const offerId = str(formData, 'offer_id');
  const quantity = Math.max(1, Number.parseInt(str(formData, 'quantity') || '0', 10) || 0);
  const giftMessage = str(formData, 'gift_message');
  if (!offerId) fail('/business/deals', 'Missing offer.');

  const { data: offer, error } = await ctx.supabase
    .from('bulk_offers')
    .select('*, bulk_offer_price_tiers(*), vendors(id,name,commission_bps), products(id,title,fulfilment_type)')
    .eq('id', offerId)
    .eq('status', 'active')
    .eq('enabled', true)
    .maybeSingle();

  if (error || !offer) fail('/business/deals', error?.message ?? 'This bulk offer is not available.');

  const now = new Date();
  if (offer.starts_at && new Date(offer.starts_at) > now) fail(`/business/offers/${offerId}`, 'This offer is not active yet.');
  if (offer.ends_at && new Date(offer.ends_at) < now) fail(`/business/offers/${offerId}`, 'This offer has ended.');
  if (quantity < (offer.min_quantity ?? 1)) fail(`/business/offers/${offerId}`, `Minimum quantity is ${offer.min_quantity}.`);
  if (offer.max_quantity != null && quantity > offer.max_quantity) fail(`/business/offers/${offerId}`, `Maximum quantity is ${offer.max_quantity}.`);
  if (offer.available_quantity != null && quantity > offer.available_quantity) {
    fail(`/business/offers/${offerId}`, 'Not enough inventory available for this quantity.');
  }

  const tiers = (offer.bulk_offer_price_tiers ?? []) as any[];
  const unitPrice = unitPriceForQuantity(Number(offer.base_unit_price_minor), tiers, quantity);
  const faceValue = Number(offer.face_value_minor);
  const totalPaid = unitPrice * quantity;
  const totalFace = faceValue * quantity;
  const discount = Math.max(0, totalFace - totalPaid);

  if (offer.min_order_value_minor != null && totalPaid < Number(offer.min_order_value_minor)) {
    fail(`/business/offers/${offerId}`, 'Order total is below the minimum order value for this offer.');
  }
  if (offer.max_order_value_minor != null && totalPaid > Number(offer.max_order_value_minor)) {
    fail(`/business/offers/${offerId}`, 'Order total exceeds the maximum order value for this offer.');
  }

  const commissionBps = Number((offer.vendors as any)?.commission_bps ?? 0);
  const platformFee = Math.round((totalPaid * commissionBps) / 10000);
  const vendorPayable = Math.max(0, totalPaid - platformFee);

  const matchedTier = [...tiers]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.min_quantity - b.min_quantity)
    .reverse()
    .find((t) => quantity >= t.min_quantity && (t.max_quantity == null || quantity <= t.max_quantity)) ?? null;

  const { data: order, error: orderError } = await ctx.supabase
    .from('bulk_orders')
    .insert({
      order_ref: makeOrderRef(),
      business_account_id: ctx.account.id,
      buyer_user_id: ctx.user.id,
      vendor_id: offer.vendor_id ?? null,
      partner_id: offer.partner_id ?? null,
      offer_id: offer.id,
      product_id: offer.product_id,
      quantity,
      face_value_minor: faceValue,
      unit_price_minor: unitPrice,
      total_face_value_minor: totalFace,
      total_paid_minor: totalPaid,
      discount_minor: discount,
      platform_fee_minor: platformFee,
      vendor_payable_minor: vendorPayable,
      currency: offer.currency || 'QAR',
      status: 'pending',
      payment_status: 'unpaid',
      gift_message: giftMessage || null,
      pricing_tier_snapshot: {
        base_unit_price_minor: offer.base_unit_price_minor,
        applied_unit_price_minor: unitPrice,
        tier: matchedTier,
        quantity,
        commission_bps: commissionBps,
        computed_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .select('id, order_ref')
    .single();

  if (orderError || !order) fail(`/business/offers/${offerId}`, orderError?.message ?? 'Could not create bulk order.');

  // One allocation row per gift card, so recipients can be assigned to cards.
  const allocations = Array.from({ length: quantity }, (_, index) => ({
    bulk_order_id: order.id,
    delivery_status: 'pending',
    assignment_index: index,
  }));
  if (allocations.length > 0) {
    await ctx.supabase.from('bulk_order_vouchers').insert(allocations);
  }

  revalidatePath('/business');
  revalidatePath('/business/orders');
  redirect(`/business/orders/${order.id}?created=1`);
}

/**
 * Assigns a pasted recipient list to the gift cards of a bulk order.
 * The first row goes to card one, the second to card two, and so on.
 */
export async function assignBulkRecipients(formData: FormData) {
  const ctx = await requireApprovedBusinessBuyer();
  const orderId = str(formData, 'order_id');
  const raw = str(formData, 'recipients');
  if (!orderId) fail('/business/orders', 'Missing order.');
  if (!raw) fail(`/business/orders/${orderId}/recipients`, 'Paste the recipient list first.');

  const { data: order } = await ctx.supabase
    .from('bulk_orders')
    .select('id, quantity, buyer_user_id')
    .eq('id', orderId)
    .eq('buyer_user_id', ctx.user.id)
    .maybeSingle();
  if (!order) fail('/business/orders', 'Order not found.');

  const { rows } = parseRecipientRows(raw);
  if (rows.length === 0) fail(`/business/orders/${orderId}/recipients`, 'No valid rows found. Use name,email per line.');

  const { error } = await ctx.supabase.rpc('assign_bulk_recipients', {
    p_bulk_order_id: orderId,
    p_rows: rows.slice(0, order.quantity),
  });
  if (error) fail(`/business/orders/${orderId}/recipients`, error.message);

  revalidatePath(`/business/orders/${orderId}`);
  revalidatePath(`/business/orders/${orderId}/recipients`);
  redirect(`/business/orders/${orderId}?assigned=1`);
}

function giftEmailHtml(params: {
  company: string;
  recipientName: string | null;
  title: string;
  faceValue: string;
  link: string;
  message: string | null;
}): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f6f4ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:2px solid #1c1c1c;border-radius:18px;padding:28px">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b6b6b">Giftly · ${params.company}</p>
      <h1 style="margin:0 0 14px;font-size:22px">You received a gift card</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5">${params.recipientName ? `Hi ${params.recipientName},` : 'Hello,'}<br />${params.company} sent you a ${params.title} worth ${params.faceValue}.</p>
      ${params.message ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.5;padding:14px;border-left:3px solid #1c1c1c;background:#faf8f3">${params.message}</p>` : ''}
      <a href="${params.link}" style="display:inline-block;background:#1c1c1c;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">Open your gift card</a>
      <p style="margin:18px 0 0;font-size:13px;color:#6b6b6b">Or open this link on your phone:<br /><span style="word-break:break-all">${params.link}</span></p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#8a8a8a;text-align:center">Gift cards are stored in the Giftly app and can be spent in parts.</p>
  </div>
</body></html>`;
}

function giftEmailText(params: {
  company: string;
  recipientName: string | null;
  title: string;
  faceValue: string;
  link: string;
  message: string | null;
}): string {
  return [
    params.recipientName ? `Hi ${params.recipientName},` : 'Hello,',
    `${params.company} sent you a ${params.title} worth ${params.faceValue}.`,
    params.message ?? '',
    `Open your gift card: ${params.link}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Sends the gift card links to every recipient of a bulk order.
 *
 * The cards have to be issued first (payment confirmed). Each recipient gets
 * their own link, exactly like a normal gift. When no email provider is
 * configured the message is queued in the outbox so the links can still be
 * downloaded and sent by hand.
 */
export async function sendBulkGiftLinks(formData: FormData) {
  const ctx = await requireApprovedBusinessBuyer();
  const orderId = str(formData, 'order_id');
  const onlyId = str(formData, 'allocation_id');
  if (!orderId) fail('/business/orders', 'Missing order.');

  const { data: order } = await ctx.supabase
    .from('bulk_orders')
    .select('*, bulk_offers(title), products(title), vendors(name), business_accounts(company_name)')
    .eq('id', orderId)
    .eq('buyer_user_id', ctx.user.id)
    .maybeSingle();
  if (!order) fail('/business/orders', 'Order not found.');

  if (!['fulfilled', 'partially_fulfilled'].includes(order.status)) {
    fail(`/business/orders/${orderId}`, 'Gift cards are issued once payment is confirmed.');
  }

  let query = ctx.supabase
    .from('bulk_order_vouchers')
    .select('*')
    .eq('bulk_order_id', orderId)
    .not('recipient_email', 'is', null);

  if (onlyId) query = query.eq('id', onlyId);

  const { data: allocations } = await query.order('assignment_index', { ascending: true });

  if (!allocations || allocations.length === 0) {
    fail(`/business/orders/${orderId}`, 'Add recipients first, then send the cards.');
  }

  const admin = createAdminClient();
  const company = (order.business_accounts as any)?.company_name ?? 'Giftly';
  const title = (order.bulk_offers as any)?.title ?? (order.products as any)?.title ?? 'gift card';
  const faceValue = `QAR ${(Number(order.face_value_minor) / 100).toFixed(2)}`;

  let sent = 0;
  let queued = 0;
  let failed = 0;

  for (const allocation of allocations as any[]) {
    const link = allocation.claim_token ? claimUrl(allocation.claim_token) : appClaimUrl(allocation.claim_token ?? '');
    const subject = `You have a gift card from ${company}`;
    const html = giftEmailHtml({
      company,
      recipientName: allocation.recipient_name,
      title,
      faceValue,
      link,
      message: allocation.gift_message ?? order.gift_message ?? null,
    });
    const text = giftEmailText({
      company,
      recipientName: allocation.recipient_name,
      title,
      faceValue,
      link,
      message: allocation.gift_message ?? order.gift_message ?? null,
    });

    const result = await sendEmail({ to: allocation.recipient_email, subject, html, text });

    const status = result.delivered ? 'sent' : result.reason === 'email_provider_not_configured' ? 'queued' : 'failed';

    await admin.from('bulk_email_outbox').insert({
      bulk_order_id: orderId,
      bulk_order_voucher_id: allocation.id,
      recipient_email: allocation.recipient_email,
      recipient_name: allocation.recipient_name,
      subject,
      body: text,
      claim_url: allocation.claim_token ? link : null,
      status,
      provider: result.delivered ? 'resend' : 'none',
      provider_message_id: result.id ?? null,
      error: result.error ?? null,
      attempts: 1,
      sent_at: result.delivered ? new Date().toISOString() : null,
    });

    await ctx.supabase
      .from('bulk_order_vouchers')
      .update({
        delivery_status: status === 'sent' ? 'sent' : status === 'queued' ? 'queued' : 'failed',
        sent_at: result.delivered ? new Date().toISOString() : null,
        send_error: result.error ?? null,
      })
      .eq('id', allocation.id);

    // Marking the card as delivered fires the in-app notification for the buyer.
    if (result.delivered && allocation.voucher_id) {
      await admin
        .from('vouchers')
        .update({ delivery_status: 'delivered', updated_at: new Date().toISOString() })
        .eq('id', allocation.voucher_id);
    }

    if (status === 'sent') sent += 1;
    else if (status === 'queued') queued += 1;
    else failed += 1;
  }

  await ctx.supabase
    .from('bulk_orders')
    .update({ sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orderId);

  revalidatePath(`/business/orders/${orderId}`);
  redirect(
    `/business/orders/${orderId}?sent=1&summary=${encodeURIComponent(`${sent} sent · ${queued} queued · ${failed} failed`)}`,
  );
}

/** Whether a real email provider is configured (used by the UI). */
export async function isEmailProviderReady() {
  return emailProviderReady();
}

/**
 * Cancels a bulk order that has not been paid for yet.
 * Cards that were already issued stay valid for the people holding them.
 */
export async function cancelBulkOrder(formData: FormData) {
  const ctx = await requireApprovedBusinessBuyer();
  const orderId = str(formData, 'order_id');
  if (!orderId) fail('/business/orders', 'Missing order.');

  const { data: order } = await ctx.supabase
    .from('bulk_orders')
    .select('id, status, payment_status')
    .eq('id', orderId)
    .eq('buyer_user_id', ctx.user.id)
    .maybeSingle();
  if (!order) fail('/business/orders', 'Order not found.');
  if (order.payment_status === 'paid') {
    fail(`/business/orders/${orderId}`, 'This order was paid, so it cannot be cancelled here. Talk to our team.');
  }

  const { error } = await ctx.supabase
    .from('bulk_orders')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('buyer_user_id', ctx.user.id);
  if (error) fail(`/business/orders/${orderId}`, error.message);

  await ctx.supabase
    .from('bulk_order_vouchers')
    .update({ delivery_status: 'cancelled' })
    .eq('bulk_order_id', orderId);

  revalidatePath('/business/orders');
  redirect('/business/orders?saved=1');
}
