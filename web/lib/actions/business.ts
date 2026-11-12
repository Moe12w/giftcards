'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireApprovedBusinessBuyer } from '@/lib/auth';

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

function unitPriceForQuantity(base: number, tiers: Array<{ min_quantity: number; max_quantity: number | null; unit_price_minor: number; sort_order?: number }>, qty: number): number {
  const sorted = [...tiers].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.min_quantity - b.min_quantity);
  let price = base;
  for (const t of sorted) {
    const maxOk = t.max_quantity == null || qty <= t.max_quantity;
    if (qty >= t.min_quantity && maxOk) price = t.unit_price_minor;
  }
  return price;
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
  const offerId = String(formData.get('offer_id') ?? '').trim();
  const quantity = Math.max(1, Number.parseInt(String(formData.get('quantity') ?? '0'), 10) || 0);
  if (!offerId) fail('/business', 'Missing offer.');

  const { data: offer, error } = await ctx.supabase
    .from('bulk_offers')
    .select('*, bulk_offer_price_tiers(*), vendors(id,name,commission_bps), products(id,title,fulfilment_type)')
    .eq('id', offerId)
    .eq('status', 'active')
    .eq('enabled', true)
    .maybeSingle();

  if (error || !offer) fail('/business', error?.message ?? 'This bulk offer is not available.');

  const now = new Date();
  if (offer.starts_at && new Date(offer.starts_at) > now) fail(`/business/offers/${offerId}`, 'This offer is not active yet.');
  if (offer.ends_at && new Date(offer.ends_at) < now) fail(`/business/offers/${offerId}`, 'This offer has ended.');
  if (quantity < (offer.min_quantity ?? 1)) fail(`/business/offers/${offerId}`, `Minimum quantity is ${offer.min_quantity}.`);
  if (offer.max_quantity != null && quantity > offer.max_quantity) fail(`/business/offers/${offerId}`, `Maximum quantity is ${offer.max_quantity}.`);
  if (offer.available_quantity != null && quantity > offer.available_quantity) fail(`/business/offers/${offerId}`, 'Not enough inventory available for this quantity.');

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

  const orderRef = makeOrderRef();
  const { data: order, error: orderError } = await ctx.supabase
    .from('bulk_orders')
    .insert({
      order_ref: orderRef,
      business_account_id: ctx.account.id,
      buyer_user_id: ctx.user.id,
      vendor_id: offer.vendor_id,
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

  // Reserve inventory if limited (best-effort; RLS allows vendor/admin updates, buyer cannot update offer directly)
  // Inventory reservation/issuance should be finalized on payment in production integrations.

  // Create allocation placeholders for distribution/export
  const vouchers = Array.from({ length: quantity }, () => ({
    bulk_order_id: order.id,
    delivery_status: 'pending',
  }));
  if (vouchers.length > 0) {
    await ctx.supabase.from('bulk_order_vouchers').insert(vouchers);
  }

  revalidatePath('/business');
  revalidatePath('/business/orders');
  redirect(`/business/orders/${order.id}?created=1`);
}

export async function updateBulkOrderAllocations(formData: FormData) {
  const ctx = await requireApprovedBusinessBuyer();
  const orderId = String(formData.get('order_id') ?? '').trim();
  if (!orderId) fail('/business/orders', 'Missing order.');

  const { data: order } = await ctx.supabase
    .from('bulk_orders')
    .select('id, buyer_user_id')
    .eq('id', orderId)
    .eq('buyer_user_id', ctx.user.id)
    .maybeSingle();
  if (!order) fail('/business/orders', 'Order not found.');

  const { data: rows } = await ctx.supabase
    .from('bulk_order_vouchers')
    .select('id')
    .eq('bulk_order_id', orderId)
    .order('created_at', { ascending: true });

  for (const row of rows ?? []) {
    const name = String(formData.get(`recipient_name_${row.id}`) ?? '').trim() || null;
    const email = String(formData.get(`recipient_email_${row.id}`) ?? '').trim() || null;
    await ctx.supabase
      .from('bulk_order_vouchers')
      .update({ recipient_name: name, recipient_email: email })
      .eq('id', row.id)
      .eq('bulk_order_id', orderId);
  }

  revalidatePath(`/business/orders/${orderId}`);
  redirect(`/business/orders/${orderId}?saved=1`);
}
