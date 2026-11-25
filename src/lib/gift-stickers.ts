// src/lib/gift-stickers.ts
// The sticker sheet shown when a sender wants to decorate a gift card without
// a photo. Stickers are semantic glyphs on a pastel die-cut badge, so they keep
// the app's outlined sticker look instead of relying on platform emoji.

export interface GiftSticker {
  id: string;
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  glyph: string;
  /** Ink colour of the glyph on the white badge. */
  tint: string;
}

export const GIFT_STICKERS: GiftSticker[] = [
  { id: 'heart', glyph: 'heart', tint: '#E05563' },
  { id: 'star', glyph: 'star', tint: '#E2A52C' },
  { id: 'cake', glyph: 'birthday', tint: '#E4708E' },
  { id: 'party', glyph: 'congratulations', tint: '#9B7BD4' },
  { id: 'flower', glyph: 'bloom', tint: '#4B9C93' },
  { id: 'gift', glyph: 'gift', tint: '#4B7BC4' },
  { id: 'sun', glyph: 'justBecause', tint: '#D9A93A' },
  { id: 'trophy', glyph: 'trophy', tint: '#C68A24' },
  { id: 'coffee', glyph: 'coffee', tint: '#8A5A3C' },
  { id: 'puppy', glyph: 'pets', tint: '#6E6E6E' },
  { id: 'rocket', glyph: 'rocket', tint: '#E05563' },
  { id: 'snow', glyph: 'seasonal', tint: '#4B7BC4' },
];

export function giftSticker(id?: string | null): GiftSticker | null {
  if (!id) return null;
  return GIFT_STICKERS.find((sticker) => sticker.id === id) ?? null;
}
