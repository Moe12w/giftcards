// src/lib/gift-covers.ts
// The designed card covers a sender can pick for a gift. These are printed
// artwork: their colour plates stay the same in light and dark mode so a cover
// always looks like the same card, which is why the colours live here rather
// than in the palette.
//
// Covers are stored on the draft by id only, so a saved draft keeps working
// when the artwork or its words change.

export type CoverDecoration = 'blobs' | 'checker' | 'confetti' | 'arch' | 'sunburst' | 'none';
export type CoverTitleStyle = 'block' | 'script';
/** Where the printed words sit on the card. */
export type CoverLayout = 'titleTop' | 'titleCenter' | 'titleBottom' | 'motifOnly';

export interface GiftCover {
  id: string;
  /** i18n key under `send.coverNames` for the gallery label. */
  nameKey: string;
  /** Direct label for an uploaded cover, used when nameKey is `custom`. */
  name?: string;
  /** An admin-uploaded image replaces the drawn artwork when present. */
  imageUrl?: string;
  /** Printed words back the cover's illustration; kept in i18n under `send.coverWords`. */
  glyph: string;
  /** Top of the plate gradient. */
  background: string;
  /** Bottom of the plate gradient. */
  backgroundTo: string;
  /** Ink for the motif. */
  ink: string;
  decoration: CoverDecoration;
  decorationColor: string;
  layout: CoverLayout;
  titleStyle: CoverTitleStyle;
  titleColor: string;
}

export const GIFT_COVERS: GiftCover[] = [
  {
    id: 'thankYou',
    nameKey: 'thankYou',
    glyph: 'bloom',
    background: '#F6B4CE',
    backgroundTo: '#E96E9E',
    ink: '#FFFFFF',
    decoration: 'blobs',
    decorationColor: '#FFFFFF',
    layout: 'titleCenter',
    titleStyle: 'script',
    titleColor: '#FFFFFF',
  },
  {
    id: 'birthday',
    nameKey: 'birthday',
    glyph: 'birthday',
    background: '#F7A85B',
    backgroundTo: '#EE7568',
    ink: '#FFF6E8',
    decoration: 'checker',
    decorationColor: '#1C1C1C',
    layout: 'titleTop',
    titleStyle: 'block',
    titleColor: '#FFFFFF',
  },
  {
    id: 'congrats',
    nameKey: 'congrats',
    glyph: 'congratulations',
    background: '#E8578A',
    backgroundTo: '#F2903C',
    ink: '#FFF6E8',
    decoration: 'confetti',
    decorationColor: '#FFF6E8',
    layout: 'titleTop',
    titleStyle: 'block',
    titleColor: '#FFFFFF',
  },
  {
    id: 'goodLuck',
    nameKey: 'goodLuck',
    glyph: 'sprout',
    background: '#FBE0C9',
    backgroundTo: '#F5C2A0',
    ink: '#4B9C93',
    decoration: 'none',
    decorationColor: '#F5C2A0',
    layout: 'titleCenter',
    titleStyle: 'script',
    titleColor: '#3E5BA9',
  },
  {
    id: 'anniversary',
    nameKey: 'anniversary',
    glyph: 'trophy',
    background: '#6E1B45',
    backgroundTo: '#3C0D25',
    ink: '#F2B233',
    decoration: 'arch',
    decorationColor: '#A6315F',
    layout: 'titleCenter',
    titleStyle: 'block',
    titleColor: '#FFFFFF',
  },
  {
    id: 'love',
    nameKey: 'love',
    glyph: 'heart',
    background: '#FDE7E4',
    backgroundTo: '#F7C4BE',
    ink: '#D9534F',
    decoration: 'blobs',
    decorationColor: '#E88C86',
    layout: 'titleCenter',
    titleStyle: 'script',
    titleColor: '#A83E3A',
  },
  {
    id: 'justBecause',
    nameKey: 'justBecause',
    glyph: 'star',
    background: '#2A38B8',
    backgroundTo: '#151D74',
    ink: '#F2B233',
    decoration: 'sunburst',
    decorationColor: '#F2B233',
    layout: 'titleBottom',
    titleStyle: 'block',
    titleColor: '#FFD9A0',
  },
  {
    id: 'treatYourself',
    nameKey: 'treatYourself',
    glyph: 'spa',
    background: '#95D096',
    backgroundTo: '#5AA76A',
    ink: '#FFFFFF',
    decoration: 'none',
    decorationColor: '#5AA76A',
    layout: 'titleTop',
    titleStyle: 'block',
    titleColor: '#E0453F',
  },
  {
    id: 'giftBox',
    nameKey: 'giftBox',
    glyph: 'gift',
    background: '#FCEFDC',
    backgroundTo: '#F3DDBC',
    ink: '#D9534F',
    decoration: 'checker',
    decorationColor: '#F0A8BC',
    layout: 'titleCenter',
    titleStyle: 'block',
    titleColor: '#8A3450',
  },
];

export const DEFAULT_COVER_ID = GIFT_COVERS[0].id;

/** A row from the admin-managed `gift_covers` table. */
export interface GiftCoverRow {
  id: string;
  name: string;
  name_ar: string | null;
  image_url: string;
}

/**
 * Turns uploaded covers into the same shape as the printed designs so the
 * chooser and the card renderer do not need two code paths. Uploaded covers
 * print no words, so they use the empty `motifOnly` layout.
 */
export function uploadedCovers(rows: GiftCoverRow[]): GiftCover[] {
  return rows
    .filter((row) => row.image_url && row.id)
    .map((row) => ({
      id: row.id,
      nameKey: 'custom',
      name: row.name,
      imageUrl: row.image_url,
      glyph: 'gift',
      background: '#F6B4CE',
      backgroundTo: '#E96E9E',
      ink: '#FFFFFF',
      decoration: 'none',
      decorationColor: '#FFFFFF',
      layout: 'motifOnly',
      titleStyle: 'block',
      titleColor: '#FFFFFF',
    }));
}

/** Resolves a stored cover id against a catalogue, falling back safely. */
export function resolveCover(id: string | null | undefined, covers: GiftCover[]): GiftCover {
  return covers.find((cover) => cover.id === id) ?? covers[0] ?? GIFT_COVERS[0];
}

/** Resolves a stored cover id, falling back to the first design. */
export function giftCover(id?: string | null): GiftCover {
  return GIFT_COVERS.find((cover) => cover.id === id) ?? GIFT_COVERS[0];
}

/** Loads the admin-managed covers. Network failures fall back to no uploads. */
export async function fetchGiftCovers(): Promise<GiftCover[]> {
  try {
    const { getSupabase, hasSupabaseConfig } = await import('./supabase');
    if (!hasSupabaseConfig) return [...GIFT_COVERS];
    const { data, error } = await getSupabase()
      .from('gift_covers')
      .select('id, name, name_ar, image_url')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (error) return [...GIFT_COVERS];
    return [...GIFT_COVERS, ...uploadedCovers((data ?? []) as GiftCoverRow[])];
  } catch {
    return [...GIFT_COVERS];
  }
}

/** The label shown for a cover, honouring an uploaded name and the locale. */
export function coverLabel(cover: GiftCover, t: (key: string) => string): string {
  if (cover.name) return cover.name;
  return t(`send.coverNames.${cover.nameKey}`);
}
