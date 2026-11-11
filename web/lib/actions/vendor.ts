'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth';
import { slugify } from '@/lib/format';
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

function returnTo(value: string, fallback: string): string {
  return value.startsWith('/vendor') ? value : fallback;
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

export async function switchVendor(formData: FormData) {
  const vendorId = str(formData, 'vendor_id');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/vendor/login');

  const { data: membership } = await supabase
    .from('vendor_members')
    .select('vendor_id')
    .eq('vendor_id', vendorId)
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  if (!membership) redirect('/vendor?error=You%20do%20not%20have%20access%20to%20that%20vendor.');

  const store = await cookies();
  store.set('gv_vendor', vendorId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect('/vendor');
}

export async function saveVendorProfile(formData: FormData) {
  const ctx = await requireVendor();
  if (ctx.role === 'redemption_staff') {
    back('/vendor/settings', 'Only owners and managers can edit the business profile.');
  }

  const name = str(formData, 'name');
  if (name.length < 2) back('/vendor/settings', 'Business name is required.');
  const destination = returnTo(str(formData, 'return_to'), '/vendor/settings');

  const { error } = await ctx.supabase
    .from('vendors')
    .update({
      name,
      name_ar: optional(formData, 'name_ar'),
      description: optional(formData, 'description'),
      logo_url: optional(formData, 'logo_url'),
      banner_url: optional(formData, 'banner_url'),
      category_id: optional(formData, 'category_id'),
      city: optional(formData, 'city'),
      area: optional(formData, 'area'),
      address: optional(formData, 'address'),
      phone: optional(formData, 'phone'),
      email: optional(formData, 'email'),
      website: optional(formData, 'website'),
      social_handle: optional(formData, 'social_handle'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.vendor.id);

  if (error) back(destination, error.message);

  const { error: applicationError } = await ctx.supabase
    .from('vendor_applications')
    .update({
      business_name: name,
      business_description: optional(formData, 'description'),
      business_email: optional(formData, 'email'),
      business_phone: optional(formData, 'phone'),
      business_location: optional(formData, 'location'),
      business_website: optional(formData, 'website'),
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_id', ctx.vendor.id);

  if (applicationError) back(destination, applicationError.message);

  revalidatePath('/vendor');
  redirect(`${destination}?saved=1`);
}

export async function submitVendorApplication(formData: FormData) {
  const ctx = await requireVendor();
  const { error } = await ctx.supabase
    .from('vendor_applications')
    .update({
      status: 'pending_review',
      step: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_id', ctx.vendor.id);

  if (error) back('/vendor/onboarding', error.message);
  revalidatePath('/vendor/onboarding');
  redirect('/vendor/onboarding?submitted=1');
}

export async function addVendorLocation(formData: FormData) {
  const ctx = await requireVendor();
  if (ctx.role === 'redemption_staff') {
    back('/vendor/settings', 'Only owners and managers can edit locations.');
  }

  const isPrimary = checkbox(formData, 'is_primary');
  if (isPrimary) {
    await ctx.supabase
      .from('vendor_locations')
      .update({ is_primary: false })
      .eq('vendor_id', ctx.vendor.id);
  }

  const { error } = await ctx.supabase.from('vendor_locations').insert({
    vendor_id: ctx.vendor.id,
    area: optional(formData, 'area'),
    address: optional(formData, 'address'),
    hours: optional(formData, 'hours'),
    is_primary: isPrimary,
  });
  if (error) back('/vendor/settings', error.message);
  revalidatePath('/vendor/settings');
  redirect('/vendor/settings?saved=1');
}

export async function removeVendorLocation(formData: FormData) {
  const ctx = await requireVendor();
  const id = str(formData, 'location_id');
  const { error } = await ctx.supabase
    .from('vendor_locations')
    .delete()
    .eq('id', id)
    .eq('vendor_id', ctx.vendor.id);
  if (error) back('/vendor/settings', error.message);
  revalidatePath('/vendor/settings');
  redirect('/vendor/settings?saved=1');
}

interface PackageDraft {
  label: string;
  sessionCount: number | null;
  priceMinor: number;
}

function parsePackages(raw: string): PackageDraft[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const [labelRaw, sessionsRaw, priceRaw] = line.split('|').map((part) => part.trim());
      const price = parseMoneyToMinor(priceRaw ?? '');
      if (!price || price <= 0) return [];
      const sessions = sessionsRaw ? Number.parseInt(sessionsRaw, 10) : null;
      return [
        {
          label: labelRaw || `Package ${index + 1}`,
          sessionCount: Number.isFinite(sessions) ? sessions : null,
          priceMinor: price,
        },
      ];
    });
}

function parsePresets(raw: string): number[] {
  return raw
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      try {
        return [parseMoneyToMinor(part)];
      } catch {
        return [];
      }
    })
    .filter((value) => value > 0);
}

function parseOccasions(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function createProduct(formData: FormData) {
  const ctx = await requireVendor();
  if (ctx.role === 'redemption_staff') {
    back('/vendor/products/new', 'Only owners and managers can create products.');
  }

  const title = str(formData, 'title');
  if (!title) back('/vendor/products/new', 'Give the gift a title.');

  const fulfilmentType = str(formData, 'fulfilment_type') === 'experience' ? 'experience' : 'monetary';
  const status = str(formData, 'status') === 'published' ? 'published' : 'draft';

  let minMinor = moneyField(formData, 'min_amount');
  let maxMinor = moneyField(formData, 'max_amount');
  let presets: number[] = [];
  let packages: PackageDraft[] = [];

  if (fulfilmentType === 'experience') {
    packages = parsePackages(str(formData, 'packages'));
    if (packages.length === 0) {
      back('/vendor/products/new', 'Add at least one package as “Label | sessions | price”.');
    }
    minMinor = Math.min(...packages.map((item) => item.priceMinor));
    maxMinor = Math.max(...packages.map((item) => item.priceMinor));
  } else {
    if (minMinor === null || minMinor <= 0) back('/vendor/products/new', 'Enter a valid minimum amount.');
    if (maxMinor === null || maxMinor <= 0) back('/vendor/products/new', 'Enter a valid maximum amount.');
    if (maxMinor < minMinor) back('/vendor/products/new', 'The maximum must be at least the minimum.');
    presets = parsePresets(str(formData, 'presets'));
    if (presets.length === 0) presets = [minMinor, maxMinor].filter((value, index, list) => list.indexOf(value) === index);
  }

  const { data: inserted, error } = await ctx.supabase
    .from('products')
    .insert({
      vendor_id: ctx.vendor.id,
      title,
      title_ar: optional(formData, 'title_ar'),
      slug: `${slugify(title) || 'gift'}-${Math.random().toString(36).slice(2, 8)}`,
      description: optional(formData, 'description'),
      terms_and_conditions: optional(formData, 'terms_and_conditions'),
      redemption_instructions: optional(formData, 'redemption_instructions'),
      fulfilment_type: fulfilmentType,
      category_id: optional(formData, 'category_id'),
      min_amount_minor: minMinor ?? 0,
      max_amount_minor: maxMinor ?? 0,
      preset_amounts_minor: presets,
      session_count:
        fulfilmentType === 'experience'
          ? Math.max(...packages.map((item) => item.sessionCount ?? 0)) || null
          : intField(formData, 'session_count'),
      currency: 'QAR',
      expiry_days: intField(formData, 'expiry_days'),
      valid_until: optional(formData, 'valid_until'),
      booking_required: checkbox(formData, 'booking_required'),
      split_session_allowed: checkbox(formData, 'split_session_allowed'),
      multi_session_per_visit: checkbox(formData, 'multi_session_per_visit'),
      is_active: status === 'published',
      status,
      icon: str(formData, 'icon') || (fulfilmentType === 'experience' ? 'sparkles' : 'gift'),
      tone:
        str(formData, 'tone') ||
        (fulfilmentType === 'experience' ? 'lavender' : 'mint'),
      location: optional(formData, 'location'),
      occasions: parseOccasions(str(formData, 'occasions')),
      image_url: optional(formData, 'image_url'),
    })
    .select('id')
    .single();

  if (error || !inserted) back('/vendor/products/new', error?.message ?? 'Could not create the gift.');

  if (fulfilmentType === 'experience') {
    const { error: variantError } = await ctx.supabase.from('product_variants').insert(
      packages.map((item, index) => ({
        product_id: inserted.id,
        kind: 'package',
        label: item.label,
        session_count: item.sessionCount,
        price_minor: item.priceMinor,
        currency: 'QAR',
        sort_order: index,
        active: true,
      })),
    );
    if (variantError) {
      await ctx.supabase.from('products').delete().eq('id', inserted.id);
      back('/vendor/products/new', variantError.message);
    }
  }

  revalidatePath('/vendor/products');
  redirect(`/vendor/products/${inserted.id}?saved=1`);
}

export async function updateProduct(formData: FormData) {
  const ctx = await requireVendor();
  if (ctx.role === 'redemption_staff') {
    back('/vendor/products', 'Only owners and managers can edit products.');
  }

  const id = str(formData, 'product_id');
  const { data: product } = await ctx.supabase
    .from('products')
    .select('id, vendor_id, fulfilment_type')
    .eq('id', id)
    .maybeSingle();
  if (!product || product.vendor_id !== ctx.vendor.id) {
    back('/vendor/products', 'That gift does not belong to this vendor.');
  }

  const title = str(formData, 'title');
  if (!title) back(`/vendor/products/${id}`, 'Give the gift a title.');
  const status = str(formData, 'status') === 'published' ? 'published' : 'draft';

  const patch: Record<string, unknown> = {
    title,
    title_ar: optional(formData, 'title_ar'),
    description: optional(formData, 'description'),
    terms_and_conditions: optional(formData, 'terms_and_conditions'),
    redemption_instructions: optional(formData, 'redemption_instructions'),
    category_id: optional(formData, 'category_id'),
    expiry_days: intField(formData, 'expiry_days'),
    valid_until: optional(formData, 'valid_until'),
    booking_required: checkbox(formData, 'booking_required'),
    split_session_allowed: checkbox(formData, 'split_session_allowed'),
    multi_session_per_visit: checkbox(formData, 'multi_session_per_visit'),
    status,
    is_active: status === 'published',
    tone: str(formData, 'tone') || 'mint',
    location: optional(formData, 'location'),
    occasions: parseOccasions(str(formData, 'occasions')),
    image_url: optional(formData, 'image_url'),
    updated_at: new Date().toISOString(),
  };

  if (product.fulfilment_type === 'monetary') {
    const minMinor = moneyField(formData, 'min_amount');
    const maxMinor = moneyField(formData, 'max_amount');
    if (minMinor === null || maxMinor === null || minMinor <= 0 || maxMinor < minMinor) {
      back(`/vendor/products/${id}`, 'Check the minimum and maximum amounts.');
    }
    let presets = parsePresets(str(formData, 'presets'));
    if (presets.length === 0) presets = [minMinor, maxMinor].filter((value, index, list) => list.indexOf(value) === index);
    patch.min_amount_minor = minMinor;
    patch.max_amount_minor = maxMinor;
    patch.preset_amounts_minor = presets;
  }

  const { error } = await ctx.supabase.from('products').update(patch).eq('id', id);
  if (error) back(`/vendor/products/${id}`, error.message);

  revalidatePath('/vendor/products');
  revalidatePath(`/vendor/products/${id}`);
  redirect(`/vendor/products/${id}?saved=1`);
}

export async function setProductStatus(formData: FormData) {
  const ctx = await requireVendor();
  if (ctx.role === 'redemption_staff') {
    back('/vendor/products', 'Only owners and managers can change a gift’s status.');
  }

  const id = str(formData, 'product_id');
  const status = str(formData, 'status');
  if (!['draft', 'published', 'archived'].includes(status)) {
    back('/vendor/products', 'Unknown product status.');
  }
  const destination = returnTo(str(formData, 'return_to'), '/vendor/products');

  const { error } = await ctx.supabase
    .from('products')
    .update({ status, is_active: status === 'published', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('vendor_id', ctx.vendor.id);
  if (error) back(destination, error.message);

  revalidatePath('/vendor/products');
  redirect(`${destination}?saved=1`);
}

export async function addProductVariant(formData: FormData) {
  const ctx = await requireVendor();
  const productId = str(formData, 'product_id');
  const label = str(formData, 'label');
  const price = moneyField(formData, 'price');
  const sessions = intField(formData, 'sessions');
  if (!label) back(`/vendor/products/${productId}`, 'Give the package a label.');
  if (price === null || price <= 0) back(`/vendor/products/${productId}`, 'Enter a valid package price.');

  const { data: product } = await ctx.supabase
    .from('products')
    .select('id, vendor_id, fulfilment_type')
    .eq('id', productId)
    .maybeSingle();
  if (!product || product.vendor_id !== ctx.vendor.id) {
    back('/vendor/products', 'That gift does not belong to this vendor.');
  }
  if (product.fulfilment_type !== 'experience') {
    back(`/vendor/products/${productId}`, 'Packages are only used by experience gifts.');
  }

  const { count } = await ctx.supabase
    .from('product_variants')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);

  const { error } = await ctx.supabase.from('product_variants').insert({
    product_id: productId,
    kind: 'package',
    label,
    session_count: sessions,
    price_minor: price,
    currency: 'QAR',
    sort_order: count ?? 0,
    active: true,
  });
  if (error) back(`/vendor/products/${productId}`, error.message);

  revalidatePath(`/vendor/products/${productId}`);
  redirect(`/vendor/products/${productId}?saved=1`);
}

export async function toggleProductVariant(formData: FormData) {
  const ctx = await requireVendor();
  const id = str(formData, 'variant_id');
  const productId = str(formData, 'product_id');
  const active = str(formData, 'active') === 'true';

  const { data: variant } = await ctx.supabase
    .from('product_variants')
    .select('id, product_id, products(vendor_id)')
    .eq('id', id)
    .maybeSingle();
  const vendorId = (variant?.products as { vendor_id?: string } | null)?.vendor_id;
  if (!variant || vendorId !== ctx.vendor.id) {
    back(`/vendor/products/${productId}`, 'That package does not belong to this vendor.');
  }

  const { error } = await ctx.supabase
    .from('product_variants')
    .update({ active })
    .eq('id', id);
  if (error) back(`/vendor/products/${productId}`, error.message);

  revalidatePath(`/vendor/products/${productId}`);
  redirect(`/vendor/products/${productId}?saved=1`);
}

export async function redeemVoucher(formData: FormData) {
  const ctx = await requireVendor();
  const code = str(formData, 'code').toUpperCase();
  const notes = optional(formData, 'notes');
  if (!code) back('/vendor/redeem', 'Enter the card code.');

  const amountRaw = str(formData, 'amount');
  const sessionsRaw = str(formData, 'sessions');
  if (!amountRaw && !sessionsRaw) {
    back('/vendor/redeem', 'Enter an amount or a number of sessions.');
  }

  let amount: number | null = null;
  if (amountRaw) {
    try {
      amount = parseMoneyToMinor(amountRaw);
    } catch {
      back('/vendor/redeem', 'That amount is not valid.');
    }
    if (amount <= 0) back('/vendor/redeem', 'The amount must be greater than zero.');
  }

  const sessions = sessionsRaw ? Number.parseInt(sessionsRaw, 10) : null;
  if (sessionsRaw && (!Number.isFinite(sessions) || (sessions ?? 0) <= 0)) {
    back('/vendor/redeem', 'Enter a valid number of sessions.');
  }

  const { data, error } = await ctx.supabase.rpc('redeem_voucher_by_code', {
    p_code: code,
    p_amount_minor: amount,
    p_sessions: sessions,
    p_notes: notes,
  });

  if (error) back('/vendor/redeem', error.message);
  const result = (Array.isArray(data) ? data[0] : data) as
    | {
        redemption_id?: string;
        redemption_reference?: string;
        kind?: string;
        remaining_value_minor?: number | null;
        sessions_remaining?: number | null;
        new_status?: string;
      }
    | null;

  if (!result) back('/vendor/redeem', 'The redemption did not return a result.');

  const query = new URLSearchParams({ ok: '1' });
  if (result.redemption_reference) query.set('reference', result.redemption_reference);
  if (result.kind) query.set('kind', result.kind);
  if (result.new_status) query.set('status', result.new_status);
  if (result.remaining_value_minor !== null && result.remaining_value_minor !== undefined) {
    query.set('remaining', String(result.remaining_value_minor));
  }
  if (result.sessions_remaining !== null && result.sessions_remaining !== undefined) {
    query.set('sessions', String(result.sessions_remaining));
  }
  revalidatePath('/vendor/vouchers');
  redirect(`/vendor/redeem?${query.toString()}`);
}

export async function inviteStaff(formData: FormData) {
  const ctx = await requireVendor();
  if (ctx.role === 'redemption_staff') {
    back('/vendor/staff', 'Only owners and managers can invite staff.');
  }

  const email = str(formData, 'email');
  const role = str(formData, 'role') || 'redemption_staff';
  if (!email) back('/vendor/staff', 'Enter the email address to invite.');
  if (!['manager', 'redemption_staff'].includes(role)) {
    back('/vendor/staff', 'Choose manager or redemption staff.');
  }
  if (ctx.role === 'manager' && role === 'manager') {
    back('/vendor/staff', 'Only the owner can invite another manager.');
  }

  const { data, error } = await ctx.supabase.rpc('create_vendor_invite', {
    p_vendor_id: ctx.vendor.id,
    p_email: email,
    p_role: role,
  });
  if (error) back('/vendor/staff', error.message);

  const result = (Array.isArray(data) ? data[0] : data) as
    | { invite_token?: string; invite_id?: string }
    | null;
  if (!result?.invite_token) back('/vendor/staff', 'The invite could not be created.');

  revalidatePath('/vendor/staff');
  redirect(`/vendor/staff?invited=${encodeURIComponent(result.invite_token)}`);
}

export async function removeStaff(formData: FormData) {
  const ctx = await requireVendor();
  const userId = str(formData, 'user_id');
  if (!userId) back('/vendor/staff', 'Choose a team member.');

  const { data: target } = await ctx.supabase
    .from('vendor_members')
    .select('user_id, role')
    .eq('vendor_id', ctx.vendor.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!target) back('/vendor/staff', 'That person is not on this team.');
  if (target.role === 'owner') back('/vendor/staff', 'The owner cannot be removed.');
  if (ctx.role === 'manager' && target.role === 'manager') {
    back('/vendor/staff', 'Only the owner can remove a manager.');
  }
  if (ctx.role === 'redemption_staff') {
    back('/vendor/staff', 'Only owners and managers can remove staff.');
  }

  const { error } = await ctx.supabase
    .from('vendor_members')
    .update({ active: false })
    .eq('vendor_id', ctx.vendor.id)
    .eq('user_id', userId);
  if (error) back('/vendor/staff', error.message);

  revalidatePath('/vendor/staff');
  redirect('/vendor/staff?saved=1');
}

export async function updateStaffRole(formData: FormData) {
  const ctx = await requireVendor();
  if (ctx.role !== 'owner') back('/vendor/staff', 'Only the owner can change roles.');

  const userId = str(formData, 'user_id');
  const role = str(formData, 'role');
  if (!['manager', 'redemption_staff'].includes(role)) {
    back('/vendor/staff', 'Choose manager or redemption staff.');
  }

  const { error } = await ctx.supabase
    .from('vendor_members')
    .update({ role })
    .eq('vendor_id', ctx.vendor.id)
    .eq('user_id', userId)
    .neq('role', 'owner');
  if (error) back('/vendor/staff', error.message);

  revalidatePath('/vendor/staff');
  redirect('/vendor/staff?saved=1');
}

/* -------------------------------------------------------------------------
 * Scanning redemption
 *
 * The customer shows the QR from the app or their wallet pass, the counter
 * staff scan it with the camera and the balance comes off straight away.
 * The manual code entry stays in place for when a camera is not practical.
 * ---------------------------------------------------------------------- */

export interface ScannedVoucher {
  id: string;
  code: string;
  title: string;
  recipient: string | null;
  fulfilmentType: string;
  status: string;
  remainingValueMinor: number | null;
  remainingSessions: number | null;
  totalSessions: number | null;
  expiresAt: string | null;
}

export interface ScanLookupResult {
  ok: boolean;
  error?: string;
  voucher?: ScannedVoucher;
  reference?: string;
  remaining?: number;
  sessions?: number;
  status?: string;
  kind?: string;
}

/**
 * Works out what was scanned. The app can show a voucher id
 * (giftly:card:...), a wallet link, or the printed code itself.
 */
function parseScanPayload(raw: string): { id?: string; code?: string } {
  const value = (raw ?? '').trim();
  if (!value) return {};

  const scheme = value.match(/^giftly:(?:card|redeem|voucher|pass):([0-9a-f-]{36})$/i);
  if (scheme) return { id: scheme[1] };

  const uuid = value.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  if (uuid) return { id: value };

  const link = value.match(/redeem\/([A-Za-z0-9-]{6,64})/i);
  if (link) return { code: link[1].toUpperCase() };

  const query = value.match(/[?&](?:code|voucher)=([A-Za-z0-9-]{6,64})/i);
  if (query) return { code: query[1].toUpperCase() };

  if (/^[A-Za-z0-9-]{6,64}$/.test(value)) return { code: value.toUpperCase() };

  return {};
}

const REDEEMABLE = ['issued', 'claimed', 'active', 'partially_redeemed'];

/**
 * Finds the scanned gift and makes sure it belongs to this vendor.
 */
async function resolveScannedVoucher(
  ctx: Awaited<ReturnType<typeof requireVendor>>,
  payload: string,
): Promise<{ ok: false; error: string } | { ok: true; voucher: ScannedVoucher }> {
  const parsed = parseScanPayload(payload);
  if (!parsed.id && !parsed.code) {
    return { ok: false, error: 'That code is not a Giftly gift.' };
  }

  let query = ctx.supabase
    .from('vouchers')
    .select(
      'id, voucher_code, fulfilment_type, status, remaining_value_minor, remaining_sessions, total_sessions, vendor_id, recipient_name, expires_at, products(title)',
    )
    .limit(1);

  query = parsed.id ? query.eq('id', parsed.id) : query.eq('voucher_code', parsed.code!);

  const { data, error } = await query.maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return { ok: false, error: 'We could not find that gift. Check the code and try again.' };
  }
  if (data.vendor_id !== ctx.vendor.id) {
    return { ok: false, error: 'That gift belongs to another business.' };
  }
  if (!REDEEMABLE.includes(String(data.status))) {
    return { ok: false, error: `That gift cannot be redeemed (${String(data.status).replace('_', ' ')}).` };
  }

  const product = Array.isArray(data.products) ? data.products[0] : data.products;
  return {
    ok: true,
    voucher: {
      id: data.id as string,
      code: (data.voucher_code ?? '') as string,
      title: product?.title ?? 'Gift card',
      recipient: (data.recipient_name ?? null) as string | null,
      fulfilmentType: String(data.fulfilment_type),
      status: String(data.status),
      remainingValueMinor:
        data.remaining_value_minor === null || data.remaining_value_minor === undefined
          ? null
          : Number(data.remaining_value_minor),
      remainingSessions:
        data.remaining_sessions === null || data.remaining_sessions === undefined
          ? null
          : Number(data.remaining_sessions),
      totalSessions:
        data.total_sessions === null || data.total_sessions === undefined
          ? null
          : Number(data.total_sessions),
      expiresAt: (data.expires_at ?? null) as string | null,
    } as ScannedVoucher,
  };
}

/** Called right after a scan: shows the vendor what is about to be redeemed. */
export async function lookupScannedVoucher(payload: string): Promise<ScanLookupResult> {
  const ctx = await requireVendor();
  const result = await resolveScannedVoucher(ctx, payload);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, voucher: result.voucher };
}

/** Redeems the scanned gift. The amount defaults to the full balance. */
export async function redeemScannedVoucher(input: {
  payload: string;
  amount?: string | null;
  sessions?: string | null;
  notes?: string | null;
}): Promise<ScanLookupResult> {
  const ctx = await requireVendor();
  const resolved = await resolveScannedVoucher(ctx, input.payload ?? '');
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const voucher = resolved.voucher;

  let amount: number | null = null;
  let sessions: number | null = null;
  const notes = (input.notes ?? '').trim() || null;

  if (voucher.fulfilmentType === 'monetary') {
    const raw = (input.amount ?? '').trim();
    if (!raw) {
      amount = voucher.remainingValueMinor;
    } else {
      try {
        amount = parseMoneyToMinor(raw);
      } catch {
        return { ok: false, error: 'That amount is not valid.' };
      }
    }
    if (!amount || amount <= 0) {
      return { ok: false, error: 'There is no balance left to redeem on this gift.' };
    }
    if (voucher.remainingValueMinor !== null && amount > voucher.remainingValueMinor) {
      return {
        ok: false,
        error: 'That is more than the balance left on this gift.',
      };
    }
  } else {
    const raw = (input.sessions ?? '').trim();
    sessions = raw ? Number.parseInt(raw, 10) : 1;
    if (!Number.isFinite(sessions) || sessions <= 0) {
      return { ok: false, error: 'Enter a valid number of sessions.' };
    }
    if (
      voucher.remainingSessions !== null &&
      voucher.totalSessions !== null &&
      sessions > voucher.remainingSessions
    ) {
      return { ok: false, error: 'That is more sessions than this gift has left.' };
    }
  }

  const { data, error } = await ctx.supabase.rpc('redeem_voucher_by_code', {
    p_code: voucher.code,
    p_amount_minor: amount,
    p_sessions: sessions,
    p_notes: notes,
  });

  if (error) return { ok: false, error: error.message };

  const result = (Array.isArray(data) ? data[0] : data) as
    | {
        redemption_reference?: string;
        kind?: string;
        remaining_value_minor?: number | null;
        sessions_remaining?: number | null;
        new_status?: string;
      }
    | null;

  if (!result) return { ok: false, error: 'The redemption did not return a result.' };

  revalidatePath('/vendor/vouchers');
  revalidatePath('/vendor/redeem');

  return {
    ok: true,
    voucher,
    reference: result.redemption_reference,
    kind: result.kind,
    remaining:
      result.remaining_value_minor === null || result.remaining_value_minor === undefined
        ? undefined
        : Number(result.remaining_value_minor),
    sessions:
      result.sessions_remaining === null || result.sessions_remaining === undefined
        ? undefined
        : Number(result.sessions_remaining),
    status: result.new_status,
  };
}
/* -------------------------------------------------------------------------
 * Storefront images
 *
 * The logo and the banner are uploaded by the vendor and stored in the
 * vendor-media bucket. The row keeps the public link, so the website and
 * the mobile app both pick the new picture up straight away.
 * ---------------------------------------------------------------------- */

const MEDIA_BUCKET = 'vendor-media';

export interface ImageActionResult {
  ok: boolean;
  error?: string;
  url?: string;
}

function mediaPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `${MEDIA_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  return url.slice(index + marker.length);
}

async function deleteStoredImage(ctx: Awaited<ReturnType<typeof requireVendor>>, url: string | null) {
  const path = mediaPathFromUrl(url);
  if (!path) return;
  if (!path.startsWith(`${ctx.vendor.id}/`)) return;
  await ctx.supabase.storage.from(MEDIA_BUCKET).remove([path]);
}

export async function uploadVendorImage(formData: FormData): Promise<ImageActionResult> {
  const ctx = await requireVendor();
  if (ctx.role === 'redemption_staff') {
    return { ok: false, error: 'Only owners and managers can change the storefront images.' };
  }

  const kind = str(formData, 'kind') === 'banner' ? 'banner' : 'logo';
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose an image to upload.' };
  }
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'That file is not an image.' };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: 'That image is too large. Keep it under 4 MB.' };
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${ctx.vendor.id}/${kind}-${Date.now()}.${extension}`;

  const { error } = await ctx.supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) return { ok: false, error: error.message };

  const { data } = ctx.supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const column = kind === 'logo' ? 'logo_url' : 'banner_url';
  const previous = kind === 'logo' ? ctx.vendor.logo_url : ctx.vendor.banner_url;

  const { error: updateError } = await ctx.supabase
    .from('vendors')
    .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', ctx.vendor.id);
  if (updateError) return { ok: false, error: updateError.message };

  await deleteStoredImage(ctx, previous);

  revalidatePath('/vendor/settings');
  revalidatePath('/vendor/onboarding');
  revalidatePath('/vendor');
  if (ctx.vendor.slug) revalidatePath(`/vendors/${ctx.vendor.slug}`);
  revalidatePath('/vendors');

  return { ok: true, url: publicUrl };
}

export async function removeVendorImage(kind: 'logo' | 'banner'): Promise<ImageActionResult> {
  const ctx = await requireVendor();
  if (ctx.role === 'redemption_staff') {
    return { ok: false, error: 'Only owners and managers can change the storefront images.' };
  }

  const column = kind === 'logo' ? 'logo_url' : 'banner_url';
  const previous = kind === 'logo' ? ctx.vendor.logo_url : ctx.vendor.banner_url;

  const { error } = await ctx.supabase
    .from('vendors')
    .update({ [column]: null, updated_at: new Date().toISOString() })
    .eq('id', ctx.vendor.id);
  if (error) return { ok: false, error: error.message };

  await deleteStoredImage(ctx, previous);

  revalidatePath('/vendor/settings');
  revalidatePath('/vendor/onboarding');
  revalidatePath('/vendor');
  if (ctx.vendor.slug) revalidatePath(`/vendors/${ctx.vendor.slug}`);
  revalidatePath('/vendors');

  return { ok: true };
}