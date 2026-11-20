'use server';

import { str, optional, back, moneyField, intField, checkbox } from './_form';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth';
import { HOME_SECTION_KEYS } from '@/lib/expo-app-config';

function saved(path: string): never {
  redirect(`${path}?saved=1`);
}

async function audit(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  action: string,
  details: Record<string, unknown>,
) {
  await supabase.rpc('record_admin_action', {
    p_action: action,
    p_target_type: 'system_setting',
    p_target_id: null,
    p_details: details,
  });
}

async function saveSetting(
  ctx: Awaited<ReturnType<typeof requireAdmin>>,
  key: string,
  value: unknown,
  description: string,
): Promise<string | null> {
  const { error } = await ctx.supabase.from('system_settings').upsert(
    {
      key,
      value,
      description,
      is_public: true,
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  return error?.message ?? null;
}

/** Home sections, their order, and the size of the gift shelves. */
export async function adminSaveExpoHome(formData: FormData) {
  const ctx = await requireAdmin();
  const path = '/admin/expo-app/home';

  const trendingLimit = intField(formData, 'trending_limit') ?? 8;
  const recommendedLimit = intField(formData, 'recommended_limit') ?? 3;
  if (trendingLimit < 1 || trendingLimit > 24) back(path, 'Trending limit must be 1–24.');
  if (recommendedLimit < 1 || recommendedLimit > 12) {
    back(path, 'Recommended limit must be 1–12.');
  }

  const sections = HOME_SECTION_KEYS.map((key, index) => ({
    key,
    visible: checkbox(formData, `visible_${key}`),
    order: intField(formData, `order_${key}`) ?? (index + 1) * 10,
  }));

  const error = await saveSetting(
    ctx,
    'expo.home',
    { sections, trendingLimit, recommendedLimit },
    'Expo home sections, order and shelf limits',
  );
  if (error) back(path, error);
  await audit(ctx.supabase, 'expo.home.update', { sections: sections.length });
  revalidatePath('/admin/expo-app');
  revalidatePath(path);
  saved(path);
}

/** Featured businesses: automatic rules plus the admin's ordered picks. */
export async function adminSaveExpoFeatured(formData: FormData) {
  const ctx = await requireAdmin();
  const path = '/admin/expo-app/featured';

  const mode = str(formData, 'mode');
  if (!['auto', 'manual', 'mixed'].includes(mode)) back(path, 'Choose a valid featured mode.');
  const sort = str(formData, 'sort');
  if (!['gift_count', 'rating'].includes(sort)) back(path, 'Choose a valid sort order.');

  const limit = intField(formData, 'limit') ?? 6;
  if (limit < 1 || limit > 24) back(path, 'Featured limit must be 1–24.');

  let businessIds: string[] = [];
  try {
    const parsed = JSON.parse(str(formData, 'business_ids') || '[]');
    if (Array.isArray(parsed)) businessIds = parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    back(path, 'The featured selection could not be read.');
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  businessIds = [...new Set(businessIds.map((id) => id.trim()).filter((id) => uuid.test(id)))].slice(0, 50);
  if (mode === 'manual' && businessIds.length === 0) {
    back(path, 'Pick at least one business for a manual shelf.');
  }

  const value = {
    mode,
    limit,
    partnerFirst: checkbox(formData, 'partner_first'),
    sort,
    prioritizeFeatured: checkbox(formData, 'prioritize_featured'),
    businessIds,
  };
  const error = await saveSetting(
    ctx,
    'expo.featured',
    value,
    'Expo featured businesses source, order and manual selection',
  );
  if (error) back(path, error);
  await audit(ctx.supabase, 'expo.featured.update', { mode, limit, count: businessIds.length });
  revalidatePath('/admin/expo-app');
  revalidatePath(path);
  saved(path);
}

/** Category labels, app visibility, home visibility, order and home limit. */
export async function adminSaveExpoCategories(formData: FormData) {
  const ctx = await requireAdmin();
  const path = '/admin/expo-app/categories';

  const homeLimit = intField(formData, 'home_limit') ?? 9;
  if (homeLimit < 1 || homeLimit > 24) back(path, 'Home category limit must be 1–24.');

  const tones = ['teal', 'pink', 'lavender', 'gold', 'sky'];
  const ids = formData.getAll('category_id').map((id) => String(id).trim()).filter(Boolean);
  for (const id of ids) {
    const tone = str(formData, `tone_${id}`);
    if (tone && !tones.includes(tone)) back(path, 'Choose a valid category colour.');
    const sortOrder = intField(formData, `sort_${id}`);
    if (sortOrder === null || sortOrder < 0 || sortOrder > 10_000) {
      back(path, 'Category order must be between 0 and 10,000.');
    }
    const { error } = await ctx.supabase
      .from('categories')
      .update({
        name: str(formData, `name_${id}`) || 'Untitled',
        name_ar: str(formData, `name_ar_${id}`) || null,
        icon: str(formData, `icon_${id}`) || 'gift',
        tone: tone || 'lavender',
        sort_order: sortOrder,
        active: checkbox(formData, `active_${id}`),
        show_on_home: checkbox(formData, `show_home_${id}`),
      })
      .eq('id', id);
    if (error) back(path, error.message);
  }

  const error = await saveSetting(
    ctx,
    'expo.categories',
    { homeLimit },
    'Number of active categories shown on the Expo home page',
  );
  if (error) back(path, error);
  await audit(ctx.supabase, 'expo.categories.update', { homeLimit, count: ids.length });
  revalidatePath('/admin/expo-app');
  revalidatePath(path);
  saved(path);
}

/** Which curated collection tiles appear on home, in what order. */
export async function adminSaveExpoCollections(formData: FormData) {
  const ctx = await requireAdmin();
  const path = '/admin/expo-app/collections';

  const homeLimit = intField(formData, 'home_limit') ?? 7;
  if (homeLimit < 1 || homeLimit > 14) back(path, 'Home collection limit must be 1–14.');

  const items = formData
    .getAll('collection_slug')
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((slug) => ({
      slug,
      visible: checkbox(formData, `visible_${slug}`),
      order: intField(formData, `order_${slug}`) ?? 0,
    }));

  const error = await saveSetting(
    ctx,
    'expo.collections',
    { homeLimit, items },
    'Expo curated collection tiles, order and home limit',
  );
  if (error) back(path, error);
  await audit(ctx.supabase, 'expo.collections.update', { homeLimit, count: items.length });
  revalidatePath('/admin/expo-app');
  revalidatePath(path);
  saved(path);
}

/** Maintenance screen and dismissible home announcement. */
export async function adminSaveExpoControls(formData: FormData) {
  const ctx = await requireAdmin();
  const path = '/admin/expo-app/controls';

  const value = {
    maintenance: {
      enabled: checkbox(formData, 'maintenance_enabled'),
      message: str(formData, 'maintenance_message'),
      messageAr: str(formData, 'maintenance_message_ar'),
    },
    announcement: {
      enabled: checkbox(formData, 'announcement_enabled'),
      text: str(formData, 'announcement_text'),
      textAr: str(formData, 'announcement_text_ar'),
    },
  };

  const error = await saveSetting(
    ctx,
    'expo.controls',
    value,
    'Expo maintenance screen and home announcement banner',
  );
  if (error) back(path, error);
  await audit(ctx.supabase, 'expo.controls.update', {
    maintenance: value.maintenance.enabled,
    announcement: value.announcement.enabled,
  });
  revalidatePath('/admin/expo-app');
  revalidatePath(path);
  saved(path);
}
