// src/lib/gift-media.ts
// Uploads the sender's card media to Supabase Storage at checkout. The draft
// holds a local file URI; the recipient needs a durable URL, so the bytes are
// uploaded to the caller's own folder in the public gift-media bucket before
// the order is created. Storage RLS limits writes to that folder.
import { File } from 'expo-file-system';

import { getSupabase, hasSupabaseConfig } from './supabase';
import type { CardBackMedia, GiftMedia } from './gift-draft';

export const GIFT_MEDIA_BUCKET = 'gift-media';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
};

export interface UploadedMedia {
  type: 'note' | 'photo' | 'gif' | 'video' | 'audio';
  url?: string;
  mimeType?: string;
  durationMs?: number | null;
  text?: string;
  attachments?: UploadedMedia[];
}

async function uploadMediaItem(
  item: { type: 'photo' | 'gif' | 'video' | 'audio'; uri?: string; url?: string; durationMs?: number },
  userId: string,
): Promise<UploadedMedia | null> {
  if (item.url) {
    return {
      type: item.type,
      url: item.url,
      ...(item.type === 'video' || item.type === 'audio' ? { durationMs: item.durationMs ?? null } : {}),
    };
  }
  if (!item.uri) return null;
  const media: GiftMedia = { type: item.type, uri: item.uri, durationMs: item.durationMs } as GiftMedia;
  return uploadGiftMedia(media, userId);
}

/** Uploads each item on the card back, preserving order and note attachments. */
export async function uploadCardBackMedia(
  items: CardBackMedia[],
  userId: string,
): Promise<UploadedMedia[]> {
  const uploaded: UploadedMedia[] = [];
  for (const item of items) {
    if (item.type === 'note') {
      const attachments: UploadedMedia[] = [];
      for (const att of item.attachments ?? []) {
        const up = await uploadMediaItem(att, userId);
        if (up) attachments.push(up);
      }
      uploaded.push({
        type: 'note',
        text: item.text,
        ...(attachments.length ? { attachments } : {}),
      });
      continue;
    }
    const up = await uploadMediaItem(item as { type: 'photo' | 'gif' | 'video' | 'audio'; uri?: string; url?: string; durationMs?: number }, userId);
    if (up) uploaded.push(up);
  }
  return uploaded;
}

/** True when a media type needs to be uploaded before checkout. */
export function needsUpload(media: GiftMedia | null): boolean {
  return Boolean(media && media.type !== 'sticker' && !('url' in media && media.url));
}

/**
 * Uploads one media file and returns the compact description stored on the
 * order. Stickers need no upload and return null.
 */
export async function uploadGiftMedia(media: GiftMedia, userId: string): Promise<UploadedMedia | null> {
  if (media.type === 'sticker') return null;
  if (media.url) {
    return {
      type: media.type,
      url: media.url,
      ...(media.type === 'video' || media.type === 'audio'
        ? { durationMs: media.durationMs ?? null }
        : {}),
    };
  }
  if (!hasSupabaseConfig) {
    throw new Error('Supabase is not configured, so media cannot be uploaded.');
  }

  const file = new File(media.uri);
  if (!file.exists) throw new Error('The selected media file is no longer on this device.');

  const extension = (file.extension || '').replace(/^\./, '').toLowerCase();
  const mimeType = MIME[extension] || file.type || 'application/octet-stream';
  const suffix = extension ? `.${extension}` : '';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${suffix}`;

  // expo-file-system's File implements Blob; supabase-js uploads the bytes
  // directly. Passing the bytes also works on React Native web.
  const body = await file.bytes();
  const { error } = await getSupabase()
    .storage.from(GIFT_MEDIA_BUCKET)
    .upload(path, body, { contentType: mimeType, upsert: false });
  if (error) throw error;

  const { data } = getSupabase().storage.from(GIFT_MEDIA_BUCKET).getPublicUrl(path);
  return {
    type: media.type,
    url: data.publicUrl,
    mimeType,
    ...(media.type === 'video' || media.type === 'audio'
      ? { durationMs: media.durationMs ?? null }
      : {}),
  };
}
