'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireEnterprise } from '@/lib/auth';
import { parseMoneyToMinor } from '@/lib/money';
import { slugify } from '@/lib/format';
import { normalizeTone } from '@/lib/catalog';
import { parseBulkTiers } from '@/lib/bulk';

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

/**
 * Keeps the gift that customers see in the app in step with the partner's
 * product: same name, the price the partner set, live or hidden.
 */
async function syncCatalogueProduct(
  ctx: Awaited<ReturnType<typeof requireEnterprise>>,
  enterpriseProductId: string,
  values: {
    name: string;
    sellingPrice: number;
    active: boolean;
    terms: string | null;
    instructions: string | null;
  },
) {
  const slug = slugify(`${values.name}-${enterpriseProductId.slice(0, 6)}`);
  const row = {
    title: values.name,
    slug,
    description: values.instructions ?? values.terms,
    fulfilment_type: 'enterprise_code',
    vendor_id: null,
    partner_id: ctx.partner.id,
    enterprise_product_id: enterpriseProductId,
    min_amount_minor: values.sellingPrice,
    max_amount_minor: values.sellingPrice,
    preset_amounts_minor: [] as number[],
    session_count: null,
    currency: 'QAR',
    expiry_days: null,
    status: values.active ? 'published' : 'draft',
    is_active: values.active,
    icon: 'gift',
    tone: 'teal',
    occasions: [] as string[],
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await ctx.supabase
    .from('products')
    .select('id')
    .eq('enterprise_product_id', enterpriseProductId)
    .maybeSingle();

  if (existing) {
    await ctx.supabase.from('products').update(row).eq('id', existing.id);
    return existing.id;
  }

  const { data: inserted } = await ctx.supabase
    .from('products')
    .insert(row)
    .select('id')
    .single();
  return inserted?.id ?? null;
}

export async function saveEnterpriseProduct(formData: FormData) {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    back('/enterprise/products', 'Analysts have read-only access to the catalogue.');
  }

  const id = str(formData, 'product_id');
  const name = str(formData, 'name');
  const denomination = moneyField(formData, 'denomination');
  const sellingPrice = moneyField(formData, 'selling_price');
  const commissionPercent = Number(str(formData, 'commission_percent') || '0');
  const commissionBps = Math.round(commissionPercent * 100);

  if (!name) back(id ? `/enterprise/products/${id}` : '/enterprise/products', 'Give the product a name.');
  if (denomination === null || denomination <= 0) {
    back(id ? `/enterprise/products/${id}` : '/enterprise/products', 'Enter a valid face value.');
  }
  if (sellingPrice === null || sellingPrice <= 0) {
    back(id ? `/enterprise/products/${id}` : '/enterprise/products', 'Enter a valid price.');
  }
  if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
    back(id ? `/enterprise/products/${id}` : '/enterprise/products', "Giftly's cut must be between 0 and 100%.");
  }

  // The partner sets the price, Giftly takes its cut, the rest is theirs.
  const partnerNet = Math.round(sellingPrice * (1 - commissionBps / 10000));

  const patch = {
    name,
    external_ref: optional(formData, 'external_ref'),
    denomination_minor: denomination,
    currency: 'QAR',
    selling_price_minor: sellingPrice,
    wholesale_cost_minor: partnerNet,
    commission_bps: commissionBps,
    terms_and_conditions: optional(formData, 'terms_and_conditions'),
    redemption_instructions: optional(formData, 'redemption_instructions'),
    expiry_days: intField(formData, 'expiry_days'),
    is_active: checkbox(formData, 'is_active'),
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data: existing } = await ctx.supabase
      .from('enterprise_products')
      .select('id, partner_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing || existing.partner_id !== ctx.partner.id) {
      back('/enterprise/products', 'That product does not belong to your partner account.');
    }
    const { error } = await ctx.supabase.from('enterprise_products').update(patch).eq('id', id);
    if (error) back(`/enterprise/products/${id}`, error.message);
    await syncCatalogueProduct(ctx, id, {
      name,
      sellingPrice,
      active: checkbox(formData, 'is_active'),
      terms: patch.terms_and_conditions,
      instructions: patch.redemption_instructions,
    });
    revalidatePath('/enterprise/products');
    revalidatePath(`/enterprise/products/${id}`);
    revalidatePath('/admin/products');
    redirect(`/enterprise/products/${id}?saved=1`);
  }

  const { data: inserted, error } = await ctx.supabase
    .from('enterprise_products')
    .insert({ partner_id: ctx.partner.id, ...patch })
    .select('id')
    .single();
  if (error || !inserted) {
    back('/enterprise/products', error?.message ?? 'Could not create the product.');
  }
  await syncCatalogueProduct(ctx, inserted.id, {
    name,
    sellingPrice,
    active: checkbox(formData, 'is_active'),
    terms: patch.terms_and_conditions,
    instructions: patch.redemption_instructions,
  });
  revalidatePath('/enterprise/products');
  revalidatePath('/admin/products');
  redirect(`/enterprise/products/${inserted.id}?saved=1`);
}

export async function toggleEnterpriseProduct(formData: FormData) {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    back('/enterprise/products', 'Analysts have read-only access to the catalogue.');
  }

  const id = str(formData, 'product_id');
  const active = str(formData, 'active') === 'true';
  const { error } = await ctx.supabase
    .from('enterprise_products')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('partner_id', ctx.partner.id);
  if (error) back('/enterprise/products', error.message);

  // The catalogue gift follows the same on/off switch.
  const { data: linked } = await ctx.supabase
    .from('products')
    .select('id')
    .eq('enterprise_product_id', id)
    .maybeSingle();
  if (linked) {
    await ctx.supabase
      .from('products')
      .update({ is_active: active, status: active ? 'published' : 'draft', updated_at: new Date().toISOString() })
      .eq('id', linked.id);
  }

  revalidatePath('/enterprise/products');
  revalidatePath('/admin/products');
  redirect('/enterprise/products?saved=1');
}

export async function importEnterpriseCodes(formData: FormData) {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    back('/enterprise/import', 'Analysts have read-only access.');
  }

  const productId = str(formData, 'enterprise_product_id');
  const filename = str(formData, 'filename') || 'manual-import.txt';
  const raw = String(formData.get('codes') ?? '');
  const codes = raw
    .split(/\r?\n/)
    .map((line) => line.split(',')[0]?.trim() ?? '')
    .filter(Boolean);

  if (!productId) back('/enterprise/import', 'Choose the product these codes belong to.');
  if (codes.length === 0) back('/enterprise/import', 'Paste at least one code.');
  if (codes.length > 2000) back('/enterprise/import', 'Import at most 2,000 codes at a time.');

  const { data: product } = await ctx.supabase
    .from('enterprise_products')
    .select('id, partner_id, denomination_minor')
    .eq('id', productId)
    .maybeSingle();
  if (!product || product.partner_id !== ctx.partner.id) {
    back('/enterprise/import', 'That product does not belong to your partner account.');
  }

  const { data: batch, error: batchError } = await ctx.supabase
    .from('enterprise_import_batches')
    .insert({
      partner_id: ctx.partner.id,
      filename,
      source: 'manual',
      total_rows: codes.length,
      status: 'processing',
    })
    .select('id')
    .single();
  if (batchError || !batch) {
    back('/enterprise/import', batchError?.message ?? 'Could not open an import batch.');
  }

  const rows = codes.map((code) => ({
    code,
    enterprise_product_id: productId,
    denomination_minor: product.denomination_minor,
    currency: 'QAR',
  }));

  const { data, error } = await ctx.supabase.rpc('import_enterprise_codes', {
    p_batch_id: batch.id,
    p_rows: rows,
  });

  if (error) {
    await ctx.supabase
      .from('enterprise_import_batches')
      .update({
        status: 'failed',
        error_report: { message: error.message },
        completed_at: new Date().toISOString(),
      })
      .eq('id', batch.id);
    back('/enterprise/import', error.message);
  }

  const result = (Array.isArray(data) ? data[0] : data) as
    | { inserted?: number; duplicates?: number; invalid?: number }
    | null;

  revalidatePath('/enterprise/import');
  revalidatePath('/enterprise/inventory');
  revalidatePath('/enterprise');
  const query = new URLSearchParams({ imported: '1' });
  if (result?.inserted !== undefined) query.set('inserted', String(result.inserted));
  if (result?.duplicates !== undefined) query.set('duplicates', String(result.duplicates));
  if (result?.invalid !== undefined) query.set('invalid', String(result.invalid));
  redirect(`/enterprise/import?${query.toString()}`);
}

export async function importEnterpriseRedemptions(formData: FormData) {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    back('/enterprise/import', 'Analysts have read-only access.');
  }

  const raw = String(formData.get('redemptions') ?? '');
  const refs = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (refs.length === 0) back('/enterprise/import', 'Paste at least one inventory reference.');
  if (refs.length > 2000) back('/enterprise/import', 'Import at most 2,000 rows at a time.');

  const { data, error } = await ctx.supabase.rpc('import_enterprise_redemptions', {
    p_partner_id: ctx.partner.id,
    p_rows: refs.map((ref) => ({ inventory_ref: ref })),
  });
  if (error) back('/enterprise/import', error.message);

  const result = (Array.isArray(data) ? data[0] : data) as
    | { confirmed?: number; skipped?: number }
    | null;

  revalidatePath('/enterprise/import');
  revalidatePath('/enterprise/inventory');
  revalidatePath('/enterprise/reports');
  const query = new URLSearchParams({ reconciled: '1' });
  if (result?.confirmed !== undefined) query.set('confirmed', String(result.confirmed));
  if (result?.skipped !== undefined) query.set('skipped', String(result.skipped));
  redirect(`/enterprise/import?${query.toString()}`);
}

export async function saveEnterpriseProfile(formData: FormData) {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    back('/enterprise/settings', 'Analysts have read-only access.');
  }

  const name = str(formData, 'name');
  if (name.length < 2) back('/enterprise/settings', 'Company name is required.');

  const { error } = await ctx.supabase
    .from('enterprise_partners')
    .update({
      name,
      website: optional(formData, 'website'),
      contact_name: optional(formData, 'contact_name'),
      contact_email: optional(formData, 'contact_email'),
      contact_phone: optional(formData, 'contact_phone'),
      industry: optional(formData, 'industry'),
      expected_volume: optional(formData, 'expected_volume'),
      notes: optional(formData, 'notes'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.partner.id);
  if (error) back('/enterprise/settings', error.message);

  const fullName = str(formData, 'full_name');
  if (fullName) {
    await ctx.supabase.from('profiles').update({ full_name: fullName }).eq('id', ctx.user.id);
  }

  revalidatePath('/enterprise');
  revalidatePath('/enterprise/settings');
  redirect('/enterprise/settings?saved=1');
}

/* -------------------------------------------------------------------------
 * Bulk products (corporate/bulk buyer offers)
 *
 * Partners publish their own bulk offers, linked to one of their catalogue
 * products, with a bulk price and volume tiers. Business buyers only ever see
 * these when the offer is active.
 * ---------------------------------------------------------------------- */

export async function createPartnerBulkOffer(formData: FormData) {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    back('/enterprise/bulk-products', 'Analysts have read-only access to bulk offers.');
  }

  const productId = str(formData, 'product_id');
  const title = str(formData, 'title');
  const faceValue = moneyField(formData, 'face_value');
  const basePrice = moneyField(formData, 'base_unit_price');
  const minQty = intField(formData, 'min_quantity') ?? 1;

  if (!productId) back('/enterprise/bulk-products/new', 'Choose the product this offer is for.');
  if (title.length < 2) back('/enterprise/bulk-products/new', 'Give the offer a title.');
  if (!faceValue || faceValue <= 0) back('/enterprise/bulk-products/new', 'Enter the face value.');
  if (basePrice === null || basePrice < 0) back('/enterprise/bulk-products/new', 'Enter the bulk selling price.');

  const { data: product } = await ctx.supabase
    .from('products')
    .select('id, partner_id')
    .eq('id', productId)
    .maybeSingle();
  if (!product || product.partner_id !== ctx.partner.id) {
    back('/enterprise/bulk-products/new', 'That product does not belong to your partner account.');
  }

  const publish = checkbox(formData, 'publish');

  const { data: offer, error } = await ctx.supabase
    .from('bulk_offers')
    .insert({
      vendor_id: null,
      partner_id: ctx.partner.id,
      product_id: productId,
      title,
      description: optional(formData, 'description'),
      image_url: optional(formData, 'image_url'),
      face_value_minor: faceValue,
      base_unit_price_minor: basePrice,
      currency: 'QAR',
      min_quantity: Math.max(1, minQty),
      max_quantity: intField(formData, 'max_quantity'),
      available_quantity: intField(formData, 'available_quantity'),
      min_order_value_minor: moneyField(formData, 'min_order_value'),
      max_order_value_minor: moneyField(formData, 'max_order_value'),
      starts_at: optional(formData, 'starts_at'),
      ends_at: optional(formData, 'ends_at'),
      expires_at: optional(formData, 'expires_at'),
      delivered_digitally: checkbox(formData, 'delivered_digitally'),
      additional_conditions: optional(formData, 'additional_conditions'),
      status: publish ? 'active' : 'draft',
      enabled: publish,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !offer) back('/enterprise/bulk-products/new', error?.message ?? 'Could not create the bulk offer.');

  const tiers = parseBulkTiers(str(formData, 'tiers'));
  if (tiers.length > 0) {
    const { error: tierError } = await ctx.supabase.from('bulk_offer_price_tiers').insert(
      tiers.map((tier, index) => ({
        offer_id: offer.id,
        min_quantity: tier.min,
        max_quantity: tier.max,
        unit_price_minor: tier.priceMinor,
        sort_order: index,
      })),
    );
    if (tierError) back(`/enterprise/bulk-products/${offer.id}`, tierError.message);
  }

  revalidatePath('/enterprise/bulk-products');
  redirect(`/enterprise/bulk-products/${offer.id}?saved=1`);
}

export async function updatePartnerBulkOffer(formData: FormData) {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    back('/enterprise/bulk-products', 'Analysts have read-only access to bulk offers.');
  }

  const offerId = str(formData, 'offer_id');
  const title = str(formData, 'title');
  const faceValue = moneyField(formData, 'face_value');
  const basePrice = moneyField(formData, 'base_unit_price');
  const minQty = intField(formData, 'min_quantity') ?? 1;

  if (!offerId) back('/enterprise/bulk-products', 'Missing offer.');
  if (title.length < 2) back(`/enterprise/bulk-products/${offerId}`, 'Give the offer a title.');
  if (!faceValue || faceValue <= 0) back(`/enterprise/bulk-products/${offerId}`, 'Enter the face value.');
  if (basePrice === null || basePrice < 0) back(`/enterprise/bulk-products/${offerId}`, 'Enter the bulk selling price.');

  const { error } = await ctx.supabase
    .from('bulk_offers')
    .update({
      title,
      description: optional(formData, 'description'),
      image_url: optional(formData, 'image_url'),
      face_value_minor: faceValue,
      base_unit_price_minor: basePrice,
      min_quantity: Math.max(1, minQty),
      max_quantity: intField(formData, 'max_quantity'),
      available_quantity: intField(formData, 'available_quantity'),
      min_order_value_minor: moneyField(formData, 'min_order_value'),
      max_order_value_minor: moneyField(formData, 'max_order_value'),
      starts_at: optional(formData, 'starts_at'),
      ends_at: optional(formData, 'ends_at'),
      expires_at: optional(formData, 'expires_at'),
      delivered_digitally: checkbox(formData, 'delivered_digitally'),
      additional_conditions: optional(formData, 'additional_conditions'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId)
    .eq('partner_id', ctx.partner.id);

  if (error) back(`/enterprise/bulk-products/${offerId}`, error.message);

  await ctx.supabase.from('bulk_offer_price_tiers').delete().eq('offer_id', offerId);
  const tiers = parseBulkTiers(str(formData, 'tiers'));
  if (tiers.length > 0) {
    const { error: tierError } = await ctx.supabase.from('bulk_offer_price_tiers').insert(
      tiers.map((tier, index) => ({
        offer_id: offerId,
        min_quantity: tier.min,
        max_quantity: tier.max,
        unit_price_minor: tier.priceMinor,
        sort_order: index,
      })),
    );
    if (tierError) back(`/enterprise/bulk-products/${offerId}`, tierError.message);
  }

  revalidatePath('/enterprise/bulk-products');
  revalidatePath(`/enterprise/bulk-products/${offerId}`);
  redirect(`/enterprise/bulk-products/${offerId}?saved=1`);
}

export async function setPartnerBulkOfferStatus(formData: FormData) {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    back('/enterprise/bulk-products', 'Analysts have read-only access to bulk offers.');
  }
  const offerId = str(formData, 'offer_id');
  const status = str(formData, 'status') as 'draft' | 'active' | 'paused' | 'expired';
  if (!['draft', 'active', 'paused', 'expired'].includes(status)) {
    back('/enterprise/bulk-products', 'Choose a valid status.');
  }

  const { error } = await ctx.supabase
    .from('bulk_offers')
    .update({ status, enabled: status === 'active', updated_at: new Date().toISOString() })
    .eq('id', offerId)
    .eq('partner_id', ctx.partner.id);
  if (error) back('/enterprise/bulk-products', error.message);

  revalidatePath('/enterprise/bulk-products');
  redirect('/enterprise/bulk-products?saved=1');
}
