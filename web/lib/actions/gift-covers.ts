'use server';

// Admin cover art lives in the `gift_covers` table and the public `gift-covers`
// storage bucket. Uploading a file here makes it appear in the app's cover
// chooser without a code change or a new build.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth';
import { str, intField, checkbox, back } from './_form';

const BUCKET = 'gift-covers';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

function saved(): never {
  redirect('/admin/expo-app/covers?saved=1');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

/** Uploads one image and upserts its catalogue row. */
export async function adminSaveGiftCover(formData: FormData) {
  const ctx = await requireAdmin();
  const path = '/admin/expo-app/covers';

  const id = str(formData, 'id');
  const name = str(formData, 'name');
  const nameAr = str(formData, 'name_ar');
  const sortOrder = intField(formData, 'sort_order') ?? 0;
  const active = checkbox(formData, 'active');
  const file = formData.get('image');

  if (!name) back(path, 'Give the cover a name.');

  const coverId = id || `${slugify(name) || 'cover'}-${Date.now().toString(36)}`;
  let imageUrl: string | null = null;
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (file.size > MAX_BYTES) back(path, 'The image must be smaller than 5 MB.');
    const extension = ALLOWED.get(file.type);
    if (!extension) back(path, 'Use a PNG, JPEG, WebP or GIF image.');
    const fileName = `${coverId}-${Date.now().toString(36)}.${extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await ctx.supabase.storage
      .from(BUCKET)
      .upload(fileName, bytes, { contentType: file.type, upsert: true });
    if (uploadError) back(path, uploadError.message);
    const { data: publicUrl } = ctx.supabase.storage.from(BUCKET).getPublicUrl(fileName);
    imageUrl = publicUrl.publicUrl;
  } else if (!id) {
    back(path, 'Choose an image to upload.');
  }
  const { error } = await ctx.supabase.from('gift_covers').upsert(
    {
      id: coverId,
      name,
      name_ar: nameAr || null,
      ...(imageUrl ? { image_url: imageUrl } : {}),
      active,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) back(path, error.message);

  await ctx.supabase.rpc('record_admin_action', {
    p_action: 'save_gift_cover',
    p_target_type: 'system_setting',
    p_target_id: null,
    p_details: { coverId, name },
  });
  revalidatePath(path);
  saved();
}

export async function adminDeleteGiftCover(formData: FormData) {
  const ctx = await requireAdmin();
  const id = str(formData, 'id');
  if (!id) back('/admin/expo-app/covers', 'Missing cover id.');

  const { error } = await ctx.supabase.from('gift_covers').delete().eq('id', id);
  if (error) back('/admin/expo-app/covers', error.message);

  await ctx.supabase.rpc('record_admin_action', {
    p_action: 'delete_gift_cover',
    p_target_type: 'system_setting',
    p_target_id: null,
    p_details: { coverId: id },
  });
  revalidatePath('/admin/expo-app/covers');
  saved();
}
