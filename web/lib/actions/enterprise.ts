'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireEnterprise } from '@/lib/auth';
import { parseMoneyToMinor } from '@/lib/money';

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

export async function saveEnterpriseProduct(formData: FormData) {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    back('/enterprise/products', 'Analysts have read-only access to the catalogue.');
  }

  const id = str(formData, 'product_id');
  const name = str(formData, 'name');
  const denomination = moneyField(formData, 'denomination');
  const sellingPrice = moneyField(formData, 'selling_price');
  const wholesale = moneyField(formData, 'wholesale_cost');
  const commissionPercent = Number(str(formData, 'commission_percent') || '0');
  const commissionBps = Math.round(commissionPercent * 100);

  if (!name) back(id ? `/enterprise/products/${id}` : '/enterprise/products', 'Give the product a name.');
  if (denomination === null || denomination <= 0) {
    back(id ? `/enterprise/products/${id}` : '/enterprise/products', 'Enter a valid denomination.');
  }
  if (sellingPrice === null || sellingPrice <= 0) {
    back(id ? `/enterprise/products/${id}` : '/enterprise/products', 'Enter a valid selling price.');
  }
  if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
    back(id ? `/enterprise/products/${id}` : '/enterprise/products', 'Commission must be between 0 and 100%.');
  }

  const patch = {
    name,
    external_ref: optional(formData, 'external_ref'),
    denomination_minor: denomination,
    currency: 'QAR',
    selling_price_minor: sellingPrice,
    wholesale_cost_minor: wholesale,
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
    revalidatePath('/enterprise/products');
    revalidatePath(`/enterprise/products/${id}`);
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
  revalidatePath('/enterprise/products');
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
  revalidatePath('/enterprise/products');
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
