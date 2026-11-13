'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { parseMoneyToMinor } from '@/lib/money';
import { createAdminClient } from '@/lib/supabase/admin';

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optional(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value || null;
}

function back(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

function moneyField(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (!raw) return null;
  try {
    return parseMoneyToMinor(raw);
  } catch {
    return null;
  }
}

function intField(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}

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
