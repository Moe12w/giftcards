'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireAdvertiser } from '@/lib/auth';
import { parseMoneyToMinor } from '@/lib/money';

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optional(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value || null;
}

function intField(formData: FormData, key: string): number | null {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
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

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}

function isoField(formData: FormData, key: string): string | null {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function friendly(message: string | undefined): string {
  if (!message) return 'Something went wrong. Please try again.';
  return message.replace(/_/g, ' ');
}

function back(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

function creativeFromForm(formData: FormData) {
  return {
    type: str(formData, 'type') || 'image',
    headline: str(formData, 'headline'),
    headline_ar: optional(formData, 'headline_ar'),
    body: optional(formData, 'body'),
    body_ar: optional(formData, 'body_ar'),
    image_url: optional(formData, 'image_url'),
    mobile_image_url: optional(formData, 'mobile_image_url'),
    image_alt: optional(formData, 'image_alt'),
    image_alt_ar: optional(formData, 'image_alt_ar'),
    cta_label: optional(formData, 'cta_label'),
    cta_label_ar: optional(formData, 'cta_label_ar'),
    destination_type: str(formData, 'destination_type') || 'url',
    destination_id: optional(formData, 'destination_id'),
    destination_url: optional(formData, 'destination_url'),
    sponsored_label: str(formData, 'sponsored_label') || 'Sponsored',
    sponsored_label_ar: str(formData, 'sponsored_label_ar') || 'إعلان مدفوع',
  };
}

function refreshAdvertiser(kind: 'vendor' | 'enterprise', id?: string) {
  const base = kind === 'enterprise' ? '/enterprise/advertising' : '/vendor/advertising';
  revalidatePath(kind === 'enterprise' ? '/enterprise' : '/vendor');
  revalidatePath(base);
  if (id) {
    revalidatePath(`${base}/campaigns/${id}`);
    revalidatePath(`${base}/checkout/${id}`);
  }
}

function refreshAdmin(id?: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/advertising');
  revalidatePath('/admin/advertising/campaigns');
  revalidatePath('/admin/advertising/finance');
  revalidatePath('/admin/advertising/advertisers');
  if (id) revalidatePath(`/admin/advertising/campaigns/${id}`);
}

// ---------------------------------------------------------------------------
// Vendor actions
// ---------------------------------------------------------------------------

export async function createAdvertisingCampaign(formData: FormData) {
  const ctx = await requireAdvertiser();
  const placementKey = str(formData, 'placement_key');
  const pricingId = str(formData, 'pricing_id');
  const name = str(formData, 'name');
  const startsAt = isoField(formData, 'starts_at');
  const endsAt = isoField(formData, 'ends_at');
  const totalBudget = moneyField(formData, 'total_budget');
  const dailyBudget = moneyField(formData, 'daily_budget') ?? 0;

  if (!placementKey || !pricingId) back(ctx.home, 'Choose a placement and pricing model.');
  if (!startsAt || !endsAt) back(ctx.home, 'Choose a start and end date.');

  const { data, error } = await ctx.supabase.rpc('advertising_create_campaign', {
    p_vendor_id: ctx.vendor.id,
    p_placement_key: placementKey,
    p_pricing_id: pricingId,
    p_name: name,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_total_budget_minor: totalBudget ?? 0,
    p_daily_budget_minor: dailyBudget,
    p_auto_renew: checkbox(formData, 'auto_renew'),
    p_creative: creativeFromForm(formData),
  });

  if (error) back(ctx.home, friendly(error.message));

  refreshAdvertiser(ctx.kind, data as string);
  redirect(`${ctx.home}/checkout/${data}`);
}

export async function updateAdvertisingCampaign(formData: FormData) {
  const ctx = await requireAdvertiser();
  const campaignId = str(formData, 'campaign_id');
  const startsAt = isoField(formData, 'starts_at');
  const endsAt = isoField(formData, 'ends_at');
  if (!campaignId) back(ctx.home, 'Missing campaign.');
  if (!startsAt || !endsAt) back(`${ctx.home}/campaigns/${campaignId}/edit`, 'Choose a start and end date.');

  const { error } = await ctx.supabase.rpc('advertising_update_campaign', {
    p_campaign_id: campaignId,
    p_name: str(formData, 'name'),
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_total_budget_minor: moneyField(formData, 'total_budget'),
    p_daily_budget_minor: moneyField(formData, 'daily_budget'),
    p_auto_renew: checkbox(formData, 'auto_renew'),
    p_creative: creativeFromForm(formData),
  });

  if (error) back(`${ctx.home}/campaigns/${campaignId}/edit`, friendly(error.message));

  refreshAdvertiser(ctx.kind, campaignId);
  redirect(`${ctx.home}/campaigns/${campaignId}?saved=1`);
}

export async function submitAdvertisingCampaign(formData: FormData) {
  const ctx = await requireAdvertiser();
  const campaignId = str(formData, 'campaign_id');
  if (!campaignId) back(ctx.home, 'Missing campaign.');

  const { error } = await ctx.supabase.rpc('advertising_submit_campaign', {
    p_campaign_id: campaignId,
  });

  if (error) back(`${ctx.home}/checkout/${campaignId}`, friendly(error.message));

  refreshAdvertiser(ctx.kind, campaignId);
  redirect(`${ctx.home}/checkout/${campaignId}?submitted=1`);
}

export async function payAdvertisingWithCredit(formData: FormData) {
  const ctx = await requireAdvertiser();
  const campaignId = str(formData, 'campaign_id');
  if (!campaignId) back(ctx.home, 'Missing campaign.');

  const { error } = await ctx.supabase.rpc('advertising_pay_with_credit', {
    p_campaign_id: campaignId,
  });

  if (error) back(`${ctx.home}/checkout/${campaignId}`, friendly(error.message));

  refreshAdvertiser(ctx.kind, campaignId);
  redirect(`${ctx.home}/campaigns/${campaignId}?paid=1`);
}

export async function pauseAdvertisingCampaign(formData: FormData) {
  const ctx = await requireAdvertiser();
  const campaignId = str(formData, 'campaign_id');
  if (!campaignId) back(ctx.home, 'Missing campaign.');
  const { error } = await ctx.supabase.rpc('advertising_pause_campaign', {
    p_campaign_id: campaignId,
    p_reason: 'vendor_paused',
  });
  if (error) back(`${ctx.home}/campaigns/${campaignId}`, friendly(error.message));
  refreshAdvertiser(ctx.kind, campaignId);
  redirect(`${ctx.home}/campaigns/${campaignId}?paused=1`);
}

export async function resumeAdvertisingCampaign(formData: FormData) {
  const ctx = await requireAdvertiser();
  const campaignId = str(formData, 'campaign_id');
  if (!campaignId) back(ctx.home, 'Missing campaign.');
  const { error } = await ctx.supabase.rpc('advertising_resume_campaign', {
    p_campaign_id: campaignId,
  });
  if (error) back(`${ctx.home}/campaigns/${campaignId}`, friendly(error.message));
  refreshAdvertiser(ctx.kind, campaignId);
  redirect(`${ctx.home}/campaigns/${campaignId}?resumed=1`);
}

export async function duplicateAdvertisingCampaign(formData: FormData) {
  const ctx = await requireAdvertiser();
  const campaignId = str(formData, 'campaign_id');
  if (!campaignId) back(ctx.home, 'Missing campaign.');
  const { data, error } = await ctx.supabase.rpc('advertising_duplicate_campaign', {
    p_campaign_id: campaignId,
  });
  if (error) back(`${ctx.home}/campaigns/${campaignId}`, friendly(error.message));
  refreshAdvertiser(ctx.kind, data as string);
  redirect(`${ctx.home}/campaigns/${data}/edit?copied=1`);
}

export async function renewAdvertisingCampaign(formData: FormData) {
  const ctx = await requireAdvertiser();
  const campaignId = str(formData, 'campaign_id');
  if (!campaignId) back(ctx.home, 'Missing campaign.');
  const { data, error } = await ctx.supabase.rpc('advertising_renew_campaign', {
    p_campaign_id: campaignId,
  });
  if (error) back(`${ctx.home}/campaigns/${campaignId}`, friendly(error.message));
  refreshAdvertiser(ctx.kind, data as string);
  redirect(`${ctx.home}/checkout/${data}`);
}

export async function markAdvertisingNotificationRead(formData: FormData) {
  const ctx = await requireAdvertiser();
  const id = str(formData, 'notification_id');
  if (id) {
    await ctx.supabase
      .from('advertising_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  }
  refreshAdvertiser(ctx.kind);
  redirect(ctx.home);
}

export interface CreativeImageActionResult {
  ok: boolean;
  error?: string;
  url?: string;
}

const AD_CREATIVE_MEDIA_BUCKET = 'vendor-media';

/**
 * Uploads a campaign creative image (banner / mobile) straight from the wizard.
 * The file is resized client-side, then stored in the vendor-media bucket under
 * the vendor id, and the public URL is returned so the creative can be saved.
 */
export async function uploadAdvertisingCreativeImage(formData: FormData): Promise<CreativeImageActionResult> {
  const ctx = await requireAdvertiser();
  const kind = str(formData, 'kind') === 'mobile_image' ? 'mobile_image' : 'image';
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
  const path = `${ctx.vendor.id}/ad-creative-${kind}-${Date.now()}.${extension}`;

  const { error } = await ctx.supabase.storage.from(AD_CREATIVE_MEDIA_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) return { ok: false, error: error.message };

  const { data } = ctx.supabase.storage.from(AD_CREATIVE_MEDIA_BUCKET).getPublicUrl(path);

  return { ok: true, url: data.publicUrl };
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

export async function adminVerifyAdvertisingPayment(formData: FormData) {
  const ctx = await requireAdmin();
  const campaignId = str(formData, 'campaign_id');
  const reference = str(formData, 'provider_reference');
  if (!campaignId) back('/admin/advertising/campaigns', 'Missing campaign.');
  if (!reference) back(`/admin/advertising/campaigns/${campaignId}`, 'Enter the payment reference.');

  const { error } = await ctx.supabase.rpc('advertising_confirm_payment', {
    p_campaign_id: campaignId,
    p_provider: 'manual',
    p_provider_reference: reference,
    p_amount_minor: moneyField(formData, 'amount'),
    p_raw_payload: { verified_by: ctx.user.id, source: 'admin' },
  });

  if (error) back(`/admin/advertising/campaigns/${campaignId}`, friendly(error.message));
  refreshAdmin(campaignId);
  redirect(`/admin/advertising/campaigns/${campaignId}?verified=1`);
}

export async function adminReviewAdvertisingCampaign(formData: FormData) {
  const ctx = await requireAdmin();
  const campaignId = str(formData, 'campaign_id');
  const decision = str(formData, 'decision');
  const note = optional(formData, 'note');
  if (!campaignId) back('/admin/advertising/campaigns', 'Missing campaign.');

  const { error } = await ctx.supabase.rpc('advertising_review_campaign', {
    p_campaign_id: campaignId,
    p_approve: decision === 'approve',
    p_note: note,
    p_checklist: {},
  });

  if (error) back(`/admin/advertising/campaigns/${campaignId}`, friendly(error.message));
  refreshAdmin(campaignId);
  redirect(`/admin/advertising/campaigns/${campaignId}?reviewed=1`);
}

export async function adminOverrideAdvertisingCampaign(formData: FormData) {
  const ctx = await requireAdmin();
  const campaignId = str(formData, 'campaign_id');
  const action = str(formData, 'override_action');
  if (!campaignId) back('/admin/advertising/campaigns', 'Missing campaign.');

  const value: Record<string, unknown> = {};
  if (action === 'extend') {
    const endsAt = isoField(formData, 'ends_at');
    if (!endsAt) back(`/admin/advertising/campaigns/${campaignId}`, 'Choose a new end date.');
    value.ends_at = endsAt;
  }
  if (action === 'refund' || action === 'credit') {
    const amount = moneyField(formData, 'amount');
    if (!amount || amount <= 0) back(`/admin/advertising/campaigns/${campaignId}`, 'Enter a valid amount.');
    value.amount_minor = amount;
    value.note = optional(formData, 'note');
  }
  if (action === 'capacity_override' || action === 'feature_business') {
    value.enabled = checkbox(formData, 'enabled');
  }

  const { error } = await ctx.supabase.rpc('advertising_admin_override', {
    p_campaign_id: campaignId,
    p_action: action,
    p_value: value,
  });

  if (error) back(`/admin/advertising/campaigns/${campaignId}`, friendly(error.message));
  refreshAdmin(campaignId);
  redirect(`/admin/advertising/campaigns/${campaignId}?override=1`);
}

export async function adminGrantAdvertisingCredit(formData: FormData) {
  const ctx = await requireAdmin();
  const vendorId = str(formData, 'vendor_id');
  const amount = moneyField(formData, 'amount');
  if (!vendorId || !amount) back('/admin/advertising/advertisers', 'Choose a vendor and amount.');

  const { error } = await ctx.supabase.rpc('advertising_grant_credit', {
    p_vendor_id: vendorId,
    p_amount_minor: amount,
    p_expires_at: isoField(formData, 'expires_at'),
    p_note: optional(formData, 'note'),
  });

  if (error) back('/admin/advertising/advertisers', friendly(error.message));
  refreshAdmin();
  redirect('/admin/advertising/advertisers?credited=1');
}

export async function adminSetAdvertiserStatus(formData: FormData) {
  const ctx = await requireAdmin();
  const vendorId = str(formData, 'vendor_id');
  const enabled = checkbox(formData, 'enabled');
  const reason = optional(formData, 'reason');
  if (!vendorId) back('/admin/advertising/advertisers', 'Missing advertiser.');

  const { error } = await ctx.supabase
    .from('vendors')
    .update({
      advertising_enabled: enabled,
      advertising_suspended_at: enabled ? null : new Date().toISOString(),
      advertising_suspended_reason: enabled ? null : reason ?? 'Suspended by admin',
      updated_at: new Date().toISOString(),
    })
    .eq('id', vendorId);

  if (error) back('/admin/advertising/advertisers', error.message);

  if (!enabled) {
    await ctx.supabase
      .from('advertising_campaigns')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        pause_reason: 'advertiser_suspended',
        updated_at: new Date().toISOString(),
      })
      .eq('vendor_id', vendorId)
      .in('status', ['active', 'scheduled']);

    await ctx.supabase.from('advertising_notifications').insert({
      audience: 'vendor',
      vendor_id: vendorId,
      kind: 'advertiser_suspended',
      title: 'Advertising access suspended',
      body: reason ?? 'Advertising access has been suspended. Your vendor account is unaffected.',
      payload: { reason },
    });
  }

  await ctx.supabase.rpc('advertising_admin_run_maintenance');
  await ctx.supabase.rpc('advertising_record_audit', {
    p_action: enabled ? 'advertiser_enabled' : 'advertiser_suspended',
    p_entity_type: 'vendor',
    p_entity_id: vendorId,
    p_details: { reason },
  });

  refreshAdmin();
  redirect('/admin/advertising/advertisers?saved=1');
}

export async function adminSaveAdvertisingPlacement(formData: FormData) {
  const ctx = await requireAdmin();
  const id = str(formData, 'placement_id');
  let config: Record<string, unknown> = {};
  const rawConfig = str(formData, 'config');
  if (rawConfig) {
    try {
      config = JSON.parse(rawConfig);
    } catch {
      back('/admin/advertising/placements', 'Placement config must be valid JSON.');
    }
  }

  const payload = {
    key: str(formData, 'key'),
    kind: str(formData, 'kind'),
    name: str(formData, 'name'),
    name_ar: optional(formData, 'name_ar'),
    description: optional(formData, 'description'),
    description_ar: optional(formData, 'description_ar'),
    format: str(formData, 'format') || 'banner',
    is_active: checkbox(formData, 'is_active'),
    supports_carousel: checkbox(formData, 'supports_carousel'),
    slot_count: intField(formData, 'slot_count') ?? 0,
    max_active_campaigns: intField(formData, 'max_active_campaigns') ?? 0,
    rotation_mode: str(formData, 'rotation_mode') || 'shared',
    auction_enabled: checkbox(formData, 'auction_enabled'),
    allowed_pricing_models: formData.getAll('allowed_pricing_models').map(String).filter(Boolean),
    priority: intField(formData, 'priority') ?? 0,
    sort_order: intField(formData, 'sort_order') ?? 0,
    creative_width: intField(formData, 'creative_width'),
    creative_height: intField(formData, 'creative_height'),
    config,
    updated_at: new Date().toISOString(),
  };

  if (!payload.key || !payload.name) back('/admin/advertising/placements', 'Key and name are required.');
  if (payload.allowed_pricing_models.length === 0) payload.allowed_pricing_models = ['fixed', 'cpc', 'cpm'];

  const { data, error } = id
    ? await ctx.supabase.from('advertising_placements').update(payload).eq('id', id).select('id').maybeSingle()
    : await ctx.supabase.from('advertising_placements').insert(payload).select('id').maybeSingle();

  if (error) back('/admin/advertising/placements', error.message);

  await ctx.supabase.rpc('advertising_record_audit', {
    p_action: id ? 'placement_updated' : 'placement_created',
    p_entity_type: 'advertising_placement',
    p_entity_id: data?.id,
    p_details: { key: payload.key },
  });

  revalidatePath('/admin/advertising/placements');
  revalidatePath('/admin/advertising');
  redirect('/admin/advertising/placements?saved=1');
}

export async function adminSaveAdvertisingPricing(formData: FormData) {
  const ctx = await requireAdmin();
  const id = str(formData, 'pricing_id');
  const placementId = str(formData, 'placement_id');
  const model = str(formData, 'pricing_model');
  if (!placementId || !model) back('/admin/advertising/placements', 'Choose a placement and model.');

  const isActive = checkbox(formData, 'is_active');
  if (isActive) {
    let deactivate = ctx.supabase
      .from('advertising_pricing')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('placement_id', placementId)
      .eq('pricing_model', model);
    if (id) deactivate = deactivate.neq('id', id);
    await deactivate;
  }

  const payload = {
    placement_id: placementId,
    pricing_model: model,
    currency: str(formData, 'currency') || 'QAR',
    fixed_price_minor: moneyField(formData, 'fixed_price') ?? 0,
    cpc_rate_minor: moneyField(formData, 'cpc_rate') ?? 0,
    cpm_rate_minor: moneyField(formData, 'cpm_rate') ?? 0,
    min_duration_days: intField(formData, 'min_duration_days') ?? 1,
    max_duration_days: intField(formData, 'max_duration_days') ?? 365,
    default_duration_days: intField(formData, 'default_duration_days') ?? 30,
    min_budget_minor: moneyField(formData, 'min_budget') ?? 0,
    max_budget_minor: moneyField(formData, 'max_budget'),
    platform_fee_bps: intField(formData, 'platform_fee_bps') ?? 0,
    tax_bps: intField(formData, 'tax_bps') ?? 0,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = id
    ? await ctx.supabase.from('advertising_pricing').update(payload).eq('id', id).select('id').maybeSingle()
    : await ctx.supabase.from('advertising_pricing').insert({ ...payload, version: 1 }).select('id').maybeSingle();

  if (error) back('/admin/advertising/placements', error.message);

  await ctx.supabase.rpc('advertising_record_audit', {
    p_action: id ? 'pricing_updated' : 'pricing_created',
    p_entity_type: 'advertising_pricing',
    p_entity_id: data?.id,
    p_details: { placement_id: placementId, pricing_model: model },
  });

  revalidatePath('/admin/advertising/placements');
  redirect('/admin/advertising/placements?saved=1');
}

export async function adminSaveAdvertisingRule(formData: FormData) {
  const ctx = await requireAdmin();
  const key = str(formData, 'key');
  const rawValue = str(formData, 'value');
  if (!key || !rawValue) back('/admin/advertising/rules', 'Key and value are required.');

  let value: unknown = rawValue;
  try {
    value = JSON.parse(rawValue);
  } catch {
    value = rawValue;
  }

  const { error } = await ctx.supabase.from('advertising_rules').upsert(
    {
      key,
      name: str(formData, 'name') || key,
      description: optional(formData, 'description'),
      value,
      value_type: str(formData, 'value_type') || 'json',
      is_active: checkbox(formData, 'is_active'),
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );

  if (error) back('/admin/advertising/rules', error.message);

  await ctx.supabase.rpc('advertising_record_audit', {
    p_action: 'rule_updated',
    p_entity_type: 'advertising_rule',
    p_details: { key, value },
  });

  revalidatePath('/admin/advertising/rules');
  redirect('/admin/advertising/rules?saved=1');
}

export async function adminRunAdvertisingMaintenance() {
  const ctx = await requireAdmin();
  const { error } = await ctx.supabase.rpc('advertising_admin_run_maintenance');
  if (error) back('/admin/advertising', error.message);
  refreshAdmin();
  redirect('/admin/advertising?maintenance=1');
}
