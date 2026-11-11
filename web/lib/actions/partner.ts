'use server';

import { redirect, revalidatePath } from 'next/navigation';
import { requireEnterprise } from '@/lib/auth';

const MEDIA_BUCKET = 'vendor-media';

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function back(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

/** Uploads or replaces a partner logo/banner image (stored under <partner-id>/). */
export async function uploadPartnerImage(formData: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    return { ok: false, error: 'Analysts have read-only access.' };
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
  const path = `${ctx.partner.id}/${kind}-${Date.now()}.${extension}`;

  const { error } = await ctx.supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) return { ok: false, error: error.message };

  const { data } = ctx.supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const column = kind === 'logo' ? 'logo_url' : 'banner_url';
  const previous = kind === 'logo' ? ctx.partner.logo_url : ctx.partner.banner_url;

  const { error: updateError } = await ctx.supabase
    .from('enterprise_partners')
    .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', ctx.partner.id);
  if (updateError) return { ok: false, error: updateError.message };

  if (previous) {
    const mediaPathFromUrl = (url: string | null): string | null => {
      if (!url) return null;
      const marker = `${MEDIA_BUCKET}/`;
      const index = url.indexOf(marker);
      if (index < 0) return null;
      return url.slice(index + marker.length);
    };
    const previousPath = mediaPathFromUrl(previous);
    if (previousPath && previousPath.startsWith(`${ctx.partner.id}/`)) {
      await ctx.supabase.storage.from(MEDIA_BUCKET).remove([previousPath]);
    }
  }

  revalidatePath('/enterprise/settings');
  revalidatePath('/enterprise');
  revalidatePath('/vendors');
  if (ctx.partner.slug) revalidatePath(`/vendors/${ctx.partner.slug}`);

  return { ok: true, url: publicUrl };
}

export async function removePartnerImage(kind: 'logo' | 'banner'): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireEnterprise();
  if (ctx.role === 'analyst') {
    return { ok: false, error: 'Analysts have read-only access.' };
  }

  const column = kind === 'logo' ? 'logo_url' : 'banner_url';
  const previous = kind === 'logo' ? ctx.partner.logo_url : ctx.partner.banner_url;

  const { error } = await ctx.supabase
    .from('enterprise_partners')
    .update({ [column]: null, updated_at: new Date().toISOString() })
    .eq('id', ctx.partner.id);
  if (error) return { ok: false, error: error.message };

  if (previous) {
    const mediaPathFromUrl = (url: string | null): string | null => {
      if (!url) return null;
      const marker = `${MEDIA_BUCKET}/`;
      const index = url.indexOf(marker);
      if (index < 0) return null;
      return url.slice(index + marker.length);
    };
    const previousPath = mediaPathFromUrl(previous);
    if (previousPath && previousPath.startsWith(`${ctx.partner.id}/`)) {
      await ctx.supabase.storage.from(MEDIA_BUCKET).remove([previousPath]);
    }
  }

  revalidatePath('/enterprise/settings');
  revalidatePath('/enterprise');
  revalidatePath('/vendors');
  if (ctx.partner.slug) revalidatePath(`/vendors/${ctx.partner.slug}`);

  return { ok: true };
}
