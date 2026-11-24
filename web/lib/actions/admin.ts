'use server';

import { str, optional, back, moneyField, intField, checkbox } from './_form';

import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { CACHE_TAGS } from '@/lib/public-cache';
import { requireAdmin } from '@/lib/auth';
import { parseMoneyToMinor } from '@/lib/money';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  appClaimUrl,
  claimUrl,
  emailProviderReady,
  forgetEmailConfig,
  getEmailConfig,
  plainHtmlFromText,
  sendClaimLinkEmail,
  sendEmail,
  sendSupportReplyEmail,
} from '@/lib/email';

async function record(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown>,
) {
  await supabase.rpc('record_admin_action', {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_details: details,
  });
}

export async function adminSetVendorStatus(formData: FormData) {
  const ctx = await requireAdmin();
  const vendorId = str(formData, 'vendor_id');
  const status = str(formData, 'status');
  const note = optional(formData, 'note');
  const returnTo = str(formData, 'return_to') || '/admin/vendors';

  if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
    back(returnTo, 'Choose a valid vendor status.');
  }
  if (!vendorId) back(returnTo, 'Missing vendor.');

  const { error } = await ctx.supabase.rpc('admin_set_vendor_status', {
    p_vendor_id: vendorId,
    p_status: status,
    p_note: note,
  });
  if (error) back(returnTo, error.message);

  revalidatePath('/admin');
  revalidatePath('/admin/vendors');
  revalidatePath(`/admin/vendors/${vendorId}`);
  revalidateTag(CACHE_TAGS.marketplace, 'max');
  redirect(`${returnTo}?saved=1`);
}

export async function adminSaveVendor(formData: FormData) {
  const ctx = await requireAdmin();
  const vendorId = str(formData, 'vendor_id');
  const returnTo = str(formData, 'return_to') || `/admin/vendors/${vendorId}`;
  if (!vendorId) back('/admin/vendors', 'Missing vendor.');

  const commissionPercent = Number(str(formData, 'commission_percent') || '0');
  if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
    back(returnTo, 'Commission must be between 0 and 100%.');
  }
  const exposure = moneyField(formData, 'max_unredeemed');
  if (exposure === null || exposure < 0) {
    back(returnTo, 'Enter a valid exposure limit.');
  }

  const { error } = await ctx.supabase
    .from('vendors')
    .update({
      commission_bps: Math.round(commissionPercent * 100),
      max_unredeemed_minor: exposure,
      is_featured: checkbox(formData, 'is_featured'),
      category_id: optional(formData, 'category_id'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', vendorId);
  if (error) back(returnTo, error.message);

  await record(ctx.supabase, 'vendor.commercial.update', 'vendor', vendorId, {
    commission_bps: Math.round(commissionPercent * 100),
    max_unredeemed_minor: exposure,
    is_featured: checkbox(formData, 'is_featured'),
  });

  revalidatePath(`/admin/vendors/${vendorId}`);
  revalidateTag(CACHE_TAGS.marketplace, 'max');
  redirect(`${returnTo}?saved=1`);
}

export async function adminSetProductStatus(formData: FormData) {
  const ctx = await requireAdmin();
  const productId = str(formData, 'product_id');
  const status = str(formData, 'status');
  const returnTo = str(formData, 'return_to') || '/admin/products';
  if (!['draft', 'published', 'archived'].includes(status)) {
    back(returnTo, 'Choose a valid product status.');
  }

  const { error } = await ctx.supabase
    .from('products')
    .update({ status, is_active: status === 'published', updated_at: new Date().toISOString() })
    .eq('id', productId);
  if (error) back(returnTo, error.message);

  await record(ctx.supabase, `product.status.${status}`, 'product', productId, {});
  revalidatePath('/admin/products');
  revalidateTag(CACHE_TAGS.marketplace, 'max');
  redirect(`${returnTo}?saved=1`);
}

export async function adminSetOrderStatus(formData: FormData) {
  const ctx = await requireAdmin();
  const orderId = str(formData, 'order_id');
  const status = str(formData, 'status');
  const returnTo = str(formData, 'return_to') || `/admin/orders/${orderId}`;
  if (!['pending', 'paid', 'failed', 'refunded'].includes(status)) {
    back(returnTo, 'Choose a valid order status.');
  }

  const patch: Record<string, unknown> = {
    status,
    payment_status: status === 'paid' ? 'paid' : status === 'refunded' ? 'refunded' : status === 'failed' ? 'failed' : 'pending',
  };
  if (status === 'paid') patch.paid_at = new Date().toISOString();

  const { error } = await ctx.supabase.from('orders').update(patch).eq('id', orderId);
  if (error) back(returnTo, error.message);

  await record(ctx.supabase, `order.status.${status}`, 'order', orderId, { status });
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`${returnTo}?saved=1`);
}

export async function adminSetVoucherStatus(formData: FormData) {
  const ctx = await requireAdmin();
  const voucherId = str(formData, 'voucher_id');
  const status = str(formData, 'status');
  const returnTo = str(formData, 'return_to') || '/admin/vouchers';
  if (!['void', 'expired'].includes(status)) {
    back(returnTo, 'Admins can only void or expire a voucher here.');
  }

  const { error } = await ctx.supabase
    .from('vouchers')
    .update({ status })
    .eq('id', voucherId);
  if (error) back(returnTo, error.message);

  await record(ctx.supabase, `voucher.status.${status}`, 'voucher', voucherId, { status });
  revalidatePath('/admin/vouchers');
  redirect(`${returnTo}?saved=1`);
}

/**
 * Issues a voucher by hand, without a payment.
 *
 * Everything the money rules require still happens in the database: the
 * voucher, its ledger entry and a real order with the vendor's commission and
 * share. The order is flagged as a manual payment so it is never confused with
 * money that actually arrived. Use it to exercise the wallet, redemption,
 * reports and statements while MyFatoorah is not connected yet.
 */
export async function adminIssueManualVoucher(formData: FormData) {
  const ctx = await requireAdmin();
  const productId = str(formData, 'product_id');
  const rawAmount = str(formData, 'amount');
  const recipientName = optional(formData, 'recipient_name');
  const recipientEmail = optional(formData, 'recipient_email');
  const giftMessage = optional(formData, 'gift_message');
  const expiresOn = optional(formData, 'expires_on');
  const note = optional(formData, 'note');

  if (!productId) back('/admin/vouchers', 'Choose the product to issue.');
  if (recipientEmail && !recipientEmail.includes('@')) {
    back('/admin/vouchers', 'Enter a valid recipient email, or leave it empty.');
  }
  if (expiresOn && Number.isNaN(new Date(expiresOn).getTime())) {
    back('/admin/vouchers', 'Choose a valid expiry date.');
  }

  let amount: number | null = null;
  if (rawAmount) {
    try {
      amount = parseMoneyToMinor(rawAmount);
    } catch {
      back('/admin/vouchers', 'Enter the value as a number, for example 100 or 100.00.');
    }
    if (amount !== null && amount <= 0) {
      back('/admin/vouchers', 'The value must be above zero.');
    }
  }

  const { data, error } = await ctx.supabase.rpc('admin_issue_manual_voucher', {
    p_product_id: productId,
    p_amount_minor: amount,
    p_recipient_name: recipientName,
    p_recipient_email: recipientEmail,
    p_gift_message: giftMessage,
    p_expires_at: expiresOn ? new Date(`${expiresOn}T23:59:59`).toISOString() : null,
    p_note: note,
  });
  if (error) back('/admin/vouchers', error.message);

  const row = (Array.isArray(data) ? data[0] : data) as
    | { voucher_id: string; voucher_code: string; claim_token: string; order_ref: string }
    | null;
  if (!row?.voucher_id) back('/admin/vouchers', 'The voucher was not created.');

  // The claim token exists only in this response, so when the admin supplied a
  // recipient address the link is emailed now instead of being shown and lost.
  let emailed: string | null = null;
  if (recipientEmail && (await emailProviderReady())) {
    const { data: created } = await ctx.supabase
      .from('vouchers')
      .select('initial_value_minor, products(title, vendors(name))')
      .eq('id', row.voucher_id)
      .maybeSingle();
    const product = Array.isArray(created?.products) ? created.products[0] : created?.products;
    const vendorRelation = product?.vendors;
    const vendor = Array.isArray(vendorRelation) ? vendorRelation[0] : vendorRelation;

    const result = await sendClaimLinkEmail({
      to: recipientEmail,
      name: recipientName,
      senderName: vendor?.name ?? 'Tazella',
      title: product?.title ?? 'a gift card',
      amountLabel: `QAR ${(Number(created?.initial_value_minor ?? amount ?? 0) / 100).toFixed(2)}`,
      link: claimUrl(row.claim_token),
      appLink: appClaimUrl(row.claim_token),
      message: giftMessage,
      locale: ctx.profile?.preferred_language === 'ar' ? 'ar' : 'en',
    });
    if (result.delivered) emailed = recipientEmail;
  }

  revalidatePath('/admin/vouchers');
  revalidatePath('/admin/orders');
  redirect(
    `/admin/vouchers?issued=${encodeURIComponent(row.voucher_code)}&claim=${encodeURIComponent(
      row.claim_token,
    )}${emailed ? `&emailed=${encodeURIComponent(emailed)}` : ''}`,
  );
}

/**
 * Sends a fresh claim link to the recipient of an unclaimed voucher.
 *
 * The stored value is only the hash of the old token, so the database mints a
 * new one and the link in any earlier message stops working. Claimed or closed
 * vouchers are refused: rotating their token would break the holder's card.
 */
export async function adminEmailClaimLink(formData: FormData) {
  const ctx = await requireAdmin();
  const voucherId = str(formData, 'voucher_id');
  const returnTo = str(formData, 'return_to') || '/admin/vouchers';
  if (!voucherId) back(returnTo, 'Missing voucher.');

  const { data: voucher } = await ctx.supabase
    .from('vouchers')
    .select(
      'id, voucher_code, status, claimed_by, recipient_name, recipient_email, initial_value_minor, gift_message, products(title, vendors(name))',
    )
    .eq('id', voucherId)
    .maybeSingle();
  if (!voucher) back(returnTo, 'Voucher not found.');
  if (!voucher.recipient_email) {
    back(returnTo, 'This voucher has no recipient email. Add one before sending.');
  }
  if (voucher.claimed_by) {
    back(returnTo, 'This gift has already been claimed, so a new link would not work.');
  }
  if (!['issued', 'claimed'].includes(String(voucher.status))) {
    back(returnTo, 'This voucher is closed, so a claim link would not work.');
  }
  if (!(await emailProviderReady())) {
    back(
      returnTo,
      'No email provider is configured, so nothing was sent. Add RESEND_API_KEY and EMAIL_FROM first.',
    );
  }

  const { data: token, error } = await ctx.supabase.rpc('admin_rotate_claim_token', {
    p_voucher_id: voucherId,
  });
  if (error) back(returnTo, error.message);
  if (!token) back(returnTo, 'The new claim link was not created.');

  const product = Array.isArray(voucher.products) ? voucher.products[0] : voucher.products;
  const vendorRelation = product?.vendors;
  const vendor = Array.isArray(vendorRelation) ? vendorRelation[0] : vendorRelation;

  const result = await sendClaimLinkEmail({
    to: voucher.recipient_email as string,
    name: voucher.recipient_name,
    senderName: vendor?.name ?? 'Tazella',
    title: product?.title ?? 'a gift card',
    amountLabel: `QAR ${(Number(voucher.initial_value_minor ?? 0) / 100).toFixed(2)}`,
    link: claimUrl(token as string),
    appLink: appClaimUrl(token as string),
    message: voucher.gift_message,
    locale: ctx.profile?.preferred_language === 'ar' ? 'ar' : 'en',
  });
  if (!result.delivered) {
    back(returnTo, `Email not sent: ${result.error ?? 'the provider refused it'}.`);
  }

  await record(ctx.supabase, 'voucher.claim_link_emailed', 'voucher', voucherId, {
    to: voucher.recipient_email,
    code: voucher.voucher_code,
  });
  revalidatePath(returnTo);
  redirect(`${returnTo}?emailed=${encodeURIComponent(voucher.recipient_email as string)}`);
}

/**
 * Re-attempts bulk gift emails that were queued while no provider was set.
 *
 * The outbox keeps the recipient, subject, text and claim link of every message
 * it queued, so adding RESEND_API_KEY and pressing this delivers the backlog
 * instead of leaving those gifts stranded.
 */
export async function adminSendQueuedEmails() {
  const ctx = await requireAdmin();
  // Read the settings again: the key may have been saved a moment ago, in a
  // different server instance than the one that cached the old answer.
  forgetEmailConfig();
  if (!(await emailProviderReady())) {
    back(
      '/admin/settings',
      'No email provider is configured. Add RESEND_API_KEY and EMAIL_FROM, then try again.',
    );
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('bulk_email_outbox')
    .select('id, recipient_email, subject, body, attempts, bulk_order_voucher_id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) back('/admin/settings', error.message);

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const body = String(row.body ?? '');
    const result = await sendEmail({
      to: row.recipient_email,
      subject: row.subject ?? 'Your Tazella gift card',
      html: plainHtmlFromText(body),
      text: body,
    });

    await admin
      .from('bulk_email_outbox')
      .update({
        status: result.delivered ? 'sent' : 'failed',
        provider: result.delivered ? 'resend' : 'none',
        provider_message_id: result.id ?? null,
        error: result.error ?? null,
        attempts: Number(row.attempts ?? 0) + 1,
        sent_at: result.delivered ? new Date().toISOString() : null,
      })
      .eq('id', row.id);

    if (row.bulk_order_voucher_id) {
      await admin
        .from('bulk_order_vouchers')
        .update({
          delivery_status: result.delivered ? 'sent' : 'failed',
          sent_at: result.delivered ? new Date().toISOString() : null,
          send_error: result.error ?? null,
        })
        .eq('id', row.bulk_order_voucher_id);
    }

    if (result.delivered) sent += 1;
    else failed += 1;
  }

  await ctx.supabase.rpc('record_admin_action', {
    p_action: 'email.outbox_retry',
    p_target_type: 'bulk_email_outbox',
    p_target_id: null,
    p_details: { attempted: (rows ?? []).length, sent, failed },
  });

  revalidatePath('/admin/settings');
  revalidatePath('/business/orders');
  redirect(`/admin/settings?sent=${sent}&failed=${failed}`);
}

/**
 * Saves the email provider settings from the admin page.
 *
 * The key is a platform secret: it goes into a private `system_settings` row,
 * is never rendered back to the browser and is only read with the service
 * role. Leaving the field empty keeps whatever key is already saved.
 */
export async function adminSaveEmailSettings(formData: FormData) {
  const ctx = await requireAdmin();
  const apiKey = str(formData, 'api_key');
  const from = str(formData, 'from');
  const removeKey = checkbox(formData, 'remove_key');

  if (apiKey && apiKey.length < 8) {
    back('/admin/settings', 'That API key looks too short. Paste the whole key from the provider dashboard.');
  }
  if (!from || !from.includes('@')) {
    back('/admin/settings', 'Add the sender address, for example Tazella <gifts@tazella.com.qa>.');
  }

  const now = new Date().toISOString();
  const rows = [
    { key: 'email.from', value: from, is_public: false, updated_by: ctx.user.id, updated_at: now },
  ];
  if (apiKey) {
    rows.push({
      key: 'email.resend_api_key',
      value: apiKey,
      is_public: false,
      updated_by: ctx.user.id,
      updated_at: now,
    });
  }

  const { error } = await ctx.supabase.from('system_settings').upsert(rows);
  if (error) back('/admin/settings', error.message);

  if (removeKey) {
    const { error: removeError } = await ctx.supabase
      .from('system_settings')
      .delete()
      .eq('key', 'email.resend_api_key');
    if (removeError) back('/admin/settings', removeError.message);
  }

  forgetEmailConfig();

  await ctx.supabase.rpc('record_admin_action', {
    p_action: removeKey ? 'setting.email_provider.removed' : 'setting.email_provider.updated',
    p_target_type: 'system_setting',
    p_target_id: null,
    p_details: { from, key_changed: Boolean(apiKey), key_removed: removeKey },
  });

  revalidatePath('/admin/settings');
  revalidatePath('/business/orders');
  redirect('/admin/settings?saved=1');
}

/** Sends one test message, so an admin can prove the provider works. */
export async function adminSendTestEmail(formData: FormData) {
  const ctx = await requireAdmin();
  const to = str(formData, 'to') || (ctx.user.email ?? '');
  if (!to || !to.includes('@')) {
    back('/admin/settings', 'Enter the address the test should go to.');
  }

  // Same reason as the retry: the key may have just been saved elsewhere.
  forgetEmailConfig();
  const config = await getEmailConfig();
  if (!config.apiKey) {
    back('/admin/settings', 'Save an API key first, then send the test.');
  }

  const body = [
    'This is a test from the Tazella admin settings.',
    '',
    `Sender: ${config.from}`,
    `Settings from: ${config.source === 'database' ? 'the dashboard' : 'the environment'}`,
    '',
    'If you are reading this, gift cards and support replies will send.',
  ].join('\n');

  const result = await sendEmail({
    to,
    subject: 'Tazella email test',
    html: plainHtmlFromText(body),
    text: body,
  });

  if (!result.delivered) {
    back(
      '/admin/settings',
      `The provider refused the test: ${result.error ?? result.reason ?? 'unknown error'}`,
    );
  }

  await ctx.supabase.rpc('record_admin_action', {
    p_action: 'setting.email_provider.tested',
    p_target_type: 'system_setting',
    p_target_id: null,
    p_details: { to, source: config.source },
  });

  revalidatePath('/admin/settings');
  redirect(`/admin/settings?tested=${encodeURIComponent(to)}`);
}

export async function adminSavePromo(formData: FormData) {
  const ctx = await requireAdmin();
  const promoId = str(formData, 'promo_id');
  const code = str(formData, 'code').toUpperCase();
  const kind = str(formData, 'kind') === 'fixed' ? 'fixed' : 'percent';
  const valueRaw = str(formData, 'value');
  const minSubtotal = moneyField(formData, 'min_subtotal') ?? 0;
  const maxRedemptions = intField(formData, 'max_redemptions');
  const startsAt = optional(formData, 'starts_at');
  const endsAt = optional(formData, 'ends_at');
  const active = checkbox(formData, 'active');

  if (!code) back('/admin/promotions', 'Enter a promo code.');
  let value = 0;
  if (kind === 'percent') {
    value = Number.parseInt(valueRaw, 10);
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      back('/admin/promotions', 'A percentage must be between 1 and 100.');
    }
  } else {
    const minor = moneyField(formData, 'value');
    if (minor === null || minor <= 0) back('/admin/promotions', 'Enter a valid fixed discount.');
    value = minor;
  }

  const patch = {
    code,
    kind,
    value,
    min_subtotal_minor: minSubtotal,
    max_redemptions: maxRedemptions,
    starts_at: startsAt,
    ends_at: endsAt,
    active,
  };

  if (promoId) {
    const { error } = await ctx.supabase.from('promo_codes').update(patch).eq('id', promoId);
    if (error) back('/admin/promotions', error.message);
    await record(ctx.supabase, 'promo.update', 'promo_code', promoId, { code });
    revalidatePath('/admin/promotions');
    redirect('/admin/promotions?saved=1');
  }

  const { data, error } = await ctx.supabase.from('promo_codes').insert(patch).select('id').single();
  if (error || !data) back('/admin/promotions', error?.message ?? 'Could not create the promo code.');
  await record(ctx.supabase, 'promo.create', 'promo_code', data.id, { code });
  revalidatePath('/admin/promotions');
  redirect('/admin/promotions?saved=1');
}

export async function adminTogglePromo(formData: FormData) {
  const ctx = await requireAdmin();
  const promoId = str(formData, 'promo_id');
  const active = str(formData, 'active') === 'true';
  const { error } = await ctx.supabase.from('promo_codes').update({ active }).eq('id', promoId);
  if (error) back('/admin/promotions', error.message);
  await record(ctx.supabase, active ? 'promo.activate' : 'promo.pause', 'promo_code', promoId, {});
  revalidatePath('/admin/promotions');
  redirect('/admin/promotions?saved=1');
}

export async function adminUpdateSupport(formData: FormData) {
  const ctx = await requireAdmin();
  const id = str(formData, 'request_id');
  const status = str(formData, 'status');
  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    back('/admin/support', 'Choose a valid request status.');
  }

  const { error } = await ctx.supabase.from('support_requests').update({ status }).eq('id', id);
  if (error) back('/admin/support', error.message);
  await record(ctx.supabase, `support.status.${status}`, 'support_request', id, {});
  revalidatePath('/admin/support');
  redirect('/admin/support?saved=1');
}

/**
 * Answers a support ticket from the admin inbox.
 *
 * The reply is stored in the shared thread the requester reads in the app or
 * their dashboard, and an open ticket moves to "in progress" so the queue
 * reflects that somebody has picked it up.
 */
export async function adminReplySupport(formData: FormData) {
  const ctx = await requireAdmin();
  const id = str(formData, 'request_id');
  const body = str(formData, 'body');
  if (!id) back('/admin/support', 'Missing request.');
  if (!body) back('/admin/support', 'Write a reply before sending.');

  const { error } = await ctx.supabase.from('support_ticket_messages').insert({
    request_id: id,
    author_id: ctx.user.id,
    author_role: 'admin',
    author_name: ctx.profile?.full_name ?? 'Tazella support',
    body,
  });
  if (error) back('/admin/support', error.message);

  const { data: ticket } = await ctx.supabase
    .from('support_requests')
    .select('status, customer_id, subject')
    .eq('id', id)
    .maybeSingle();
  if (ticket?.status === 'open') {
    await ctx.supabase.from('support_requests').update({ status: 'in_progress' }).eq('id', id);
  }

  // The in-app notification is written by a database trigger, so it is always
  // there. The email is best effort: a missing provider or a bad address must
  // never lose the reply that was already stored. The admin is told when it
  // did not go out, so nobody assumes the requester has read it.
  let emailSent = false;
  if (ticket?.customer_id && (await emailProviderReady())) {
    const { data: requester } = await ctx.supabase
      .from('profiles')
      .select('email, full_name, preferred_language')
      .eq('id', ticket.customer_id)
      .maybeSingle();

    if (requester?.email) {
      const result = await sendSupportReplyEmail({
        to: requester.email,
        name: requester.full_name,
        ticketSubject: ticket.subject ?? 'Support request',
        reply: body,
        locale: requester.preferred_language === 'ar' ? 'ar' : 'en',
      }).catch(() => null);
      emailSent = Boolean(result?.delivered);
    }
  }

  await record(ctx.supabase, 'support.reply', 'support_request', id, {});
  revalidatePath('/admin/support');
  revalidatePath('/vendor/support');
  revalidatePath('/enterprise/support');
  revalidatePath('/business/support');
  redirect(`/admin/support?saved=1${emailSent ? '' : '&warn=email-not-sent'}`);
}

export async function adminUpdatePartner(formData: FormData) {
  const ctx = await requireAdmin();
  const partnerId = str(formData, 'partner_id');
  const status = str(formData, 'status');
  const returnTo = str(formData, 'return_to') || `/admin/enterprise/${partnerId}`;
  if (!['draft', 'active', 'suspended'].includes(status)) {
    back(returnTo, 'Choose a valid partner status.');
  }

  const { error } = await ctx.supabase
    .from('enterprise_partners')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', partnerId);
  if (error) back(returnTo, error.message);
  await record(ctx.supabase, `partner.status.${status}`, 'enterprise_partner', partnerId, {});
  revalidatePath('/admin/enterprise');
  revalidatePath(`/admin/enterprise/${partnerId}`);
  redirect(`${returnTo}?saved=1`);
}

export async function adminUpdateCustomer(formData: FormData) {
  const ctx = await requireAdmin();
  const userId = str(formData, 'user_id');
  const status = str(formData, 'status');
  const returnTo = str(formData, 'return_to') || `/admin/customers/${userId}`;
  if (!['active', 'suspended'].includes(status)) {
    back(returnTo, 'Choose a valid customer status.');
  }

  const { error } = await ctx.supabase.from('profiles').update({ status }).eq('id', userId);
  if (error) back(returnTo, error.message);
  await record(ctx.supabase, `customer.status.${status}`, 'profile', userId, {});
  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${userId}`);
  redirect(`${returnTo}?saved=1`);
}

export async function adminSaveSetting(formData: FormData) {
  const ctx = await requireAdmin();
  const key = str(formData, 'key');
  const raw = String(formData.get('value') ?? '').trim();
  const isPublic = checkbox(formData, 'is_public');
  if (!key) back('/admin/settings', 'Missing setting key.');

  let value: unknown = raw;
  try {
    value = JSON.parse(raw);
  } catch {
    value = raw;
  }

  const { error } = await ctx.supabase.from('system_settings').upsert({
    key,
    value,
    is_public: isPublic,
    updated_by: ctx.user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) back('/admin/settings', error.message);
  await record(ctx.supabase, 'setting.update', 'system_setting', key, {});
  revalidatePath('/admin/settings');
  redirect('/admin/settings?saved=1');
}

export async function adminSetBusinessAccountStatus(formData: FormData) {
  const ctx = await requireAdmin();
  const accountId = str(formData, 'account_id');
  const status = str(formData, 'status');
  const note = optional(formData, 'note');
  const returnTo = str(formData, 'return_to') || '/admin/business-accounts';

  if (!['pending_approval', 'approved', 'rejected', 'suspended'].includes(status)) {
    back(returnTo, 'Choose a valid business account status.');
  }
  if (!accountId) back(returnTo, 'Missing business account.');

  const { error } = await ctx.supabase.rpc('admin_set_business_account_status', {
    p_account_id: accountId,
    p_status: status,
    p_note: note,
  });
  if (error) back(returnTo, error.message);

  await record(ctx.supabase, `business_account.status.${status}`, 'business_account', accountId, { status });
  revalidatePath('/admin/business-accounts');
  redirect(`${returnTo}?saved=1`);
}

/* -------------------------------------------------------------------------
 * Bulk purchasing: fulfilment and moderation
 * ---------------------------------------------------------------------- */

/**
 * Confirms payment for a bulk order and issues one gift card per unit.
 *
 * The cards are issued by the database (reusing the normal gift card
 * issuance), so every card has its own identifier, redemption value and
 * claim link. The buyer then sends them to their recipients.
 */
export async function adminFulfilBulkOrder(formData: FormData) {
  const ctx = await requireAdmin();
  const orderId = str(formData, 'order_id');
  if (!orderId) back('/admin/bulk-orders', 'Missing bulk order.');

  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from('bulk_orders')
    .select('id, order_ref, quantity, status')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError || !order) back('/admin/bulk-orders', orderError?.message ?? 'Bulk order not found.');

  const { error } = await admin.rpc('fulfill_bulk_order', {
    p_bulk_order_id: orderId,
  });
  if (error) back('/admin/bulk-orders', error.message);

  await record(ctx.supabase, 'bulk_order.fulfilled', 'bulk_order', orderId, { quantity: order.quantity });
  revalidatePath('/admin/bulk-orders');
  redirect(`/admin/bulk-orders?saved=1`);
}

/** Pauses, resumes or removes a bulk offer. */
export async function adminSetBulkOfferStatus(formData: FormData) {
  const ctx = await requireAdmin();
  const offerId = str(formData, 'offer_id');
  const status = str(formData, 'status');
  const enabled = formData.get('enabled') === 'on' || formData.get('enabled') === 'true';
  if (!offerId) back('/admin/bulk-products', 'Missing bulk offer.');
  if (!['draft', 'active', 'paused', 'expired'].includes(status)) {
    back('/admin/bulk-products', 'Choose a valid status.');
  }

  const { error } = await ctx.supabase
    .from('bulk_offers')
    .update({ status, enabled, updated_at: new Date().toISOString() })
    .eq('id', offerId);
  if (error) back('/admin/bulk-products', error.message);

  await record(ctx.supabase, `bulk_offer.status.${status}`, 'bulk_offer', offerId, { enabled });
  revalidatePath('/admin/bulk-products');
  redirect('/admin/bulk-products?saved=1');
}

/** Cancels or refunds a bulk order. Issued cards stay valid for their holders. */
export async function adminSetBulkOrderStatus(formData: FormData) {
  const ctx = await requireAdmin();
  const orderId = str(formData, 'order_id');
  const status = str(formData, 'status');
  const note = optional(formData, 'note');
  if (!orderId) back('/admin/bulk-orders', 'Missing bulk order.');
  if (!['cancelled', 'refunded', 'failed'].includes(status)) {
    back('/admin/bulk-orders', 'Choose a valid status.');
  }

  const { error } = await ctx.supabase.rpc('admin_set_bulk_order_status', {
    p_bulk_order_id: orderId,
    p_status: status,
    p_note: note,
  });
  if (error) back('/admin/bulk-orders', error.message);

  await record(ctx.supabase, `bulk_order.status.${status}`, 'bulk_order', orderId, { status });
  revalidatePath('/admin/bulk-orders');
  redirect('/admin/bulk-orders?saved=1');
}

/**
 * Turns the approval requirement for new business accounts on or off.
 * When it is off, a new registration can buy bulk offers straight away.
 */
export async function adminSetBulkRegistrationApproval(formData: FormData) {
  const ctx = await requireAdmin();
  const required = formData.get('required') === 'on' || formData.get('required') === 'true';

  const { error } = await ctx.supabase.from('system_settings').upsert({
    key: 'bulk_registration_requires_approval',
    value: required,
    is_public: false,
    updated_by: ctx.user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) back('/admin/business-accounts', error.message);

  await record(ctx.supabase, 'setting.bulk_registration_requires_approval', 'system_setting', 'bulk_registration_requires_approval', { required });
  revalidatePath('/admin/business-accounts');
  redirect('/admin/business-accounts?saved=1');
}
