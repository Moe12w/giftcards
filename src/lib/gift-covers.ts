// src/lib/gift-covers.ts
// The designed card covers a sender can pick for a gift. These are printed
// artwork: their colour plates stay the same in light and dark mode so a cover
// always looks like the same card, which is why the colours live here rather
// than in the palette.
//
// The look is a printed greeting card: a bright plate scattered with painted
// shapes, bold stacked lettering, and a watercolour illustration panel.
//
// Covers are stored on the draft by id only, so a saved draft keeps working
// when the artwork or its words change.

export type CoverDecoration =
  | 'blobs'
  | 'checker'
  | 'confetti'
  | 'squiggles'
  | 'dots'
  | 'arch'
  | 'sunburst'
  | 'none';
export type CoverTitleStyle = 'block' | 'script';
/** Where the printed words sit on the card. */
export type CoverLayout = 'titleTop' | 'titleCenter' | 'titleBottom' | 'motifOnly';
/** A painted illustration panel printed on the card, bundled with the app. */
export type CoverIllustration = 'birthday' | 'bath' | 'flowers' | 'fireworks';

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
  /** Painted shape colours scattered over the plate. */
  palette?: string[];
  /** One colour per printed word, cycling if there are fewer colours than words. */
  titleColors?: string[];
  /** Watercolour panel printed on the card, replacing the glyph motif. */
  illustration?: CoverIllustration;
  layout: CoverLayout;
  titleStyle: CoverTitleStyle;
  titleColor: string;
}

/** The painted card colours: coral, tangerine, butter, navy and violet. */
const WARM_PALETTE = ['#E0453F', '#F79A3C', '#F6CE45', '#3E5BA9', '#8B6BD9'];

export const GIFT_COVERS: GiftCover[] = [
  {
    id: 'thankYou',
    nameKey: 'thankYou',
    glyph: 'bloom',
    background: '#FFF2DC',
    backgroundTo: '#FFDFBE',
    ink: '#E0453F',
    decoration: 'confetti',
    decorationColor: '#F6CE45',
    palette: WARM_PALETTE,
    titleColors: ['#E0453F'],
    illustration: 'flowers',
    layout: 'titleTop',
    titleStyle: 'script',
    titleColor: '#E0453F',
  },
  {
    id: 'birthday',
    nameKey: 'birthday',
    glyph: 'birthday',
    background: '#FFB45C',
    backgroundTo: '#F87A5C',
    ink: '#FFF6E8',
    decoration: 'confetti',
    decorationColor: '#FFF6E8',
    palette: ['#FFFFFF', '#F6CE45', '#F4567C', '#3FA9A0', '#8B6BD9'],
    titleColors: ['#FFFFFF', '#FFF0B0'],
    illustration: 'birthday',
    layout: 'titleTop',
    titleStyle: 'block',
    titleColor: '#FFFFFF',
  },
  {
    id: 'congrats',
    nameKey: 'congrats',
    glyph: 'congratulations',
    background: '#FF84AB',
    backgroundTo: '#F0507F',
    ink: '#FFF6E8',
    decoration: 'squiggles',
    decorationColor: '#FFF0B0',
    palette: ['#FFF0B0', '#F79A3C', '#3FA9A0', '#8B6BD9'],
    titleColors: ['#FFFFFF', '#FFE066'],
    layout: 'titleTop',
    titleStyle: 'block',
    titleColor: '#FFFFFF',
  },
  {
    id: 'goodLuck',
    nameKey: 'goodLuck',
    glyph: 'sprout',
    background: '#FBF3D4',
    backgroundTo: '#F0E1A9',
    ink: '#2F7D67',
    decoration: 'dots',
    decorationColor: '#2F7D67',
    palette: ['#7FBF6A', '#F6CE45', '#F79A3C', '#3FA9A0'],
    titleColors: ['#2F7D67'],
    layout: 'titleCenter',
    titleStyle: 'script',
    titleColor: '#2F7D67',
  },
  {
    id: 'anniversary',
    nameKey: 'anniversary',
    glyph: 'trophy',
    background: '#4E1032',
    backgroundTo: '#26061A',
    ink: '#F2B233',
    decoration: 'squiggles',
    decorationColor: '#F2B233',
    palette: ['#F4A0C0', '#F2B233', '#8FD3A8', '#C9A9F5'],
    titleColors: ['#FFFFFF', '#FFD9A0'],
    layout: 'titleCenter',
    titleStyle: 'block',
    titleColor: '#FFFFFF',
  },
  {
    id: 'love',
    nameKey: 'love',
    glyph: 'heart',
    background: '#FFE4E9',
    backgroundTo: '#FFBDCD',
    ink: '#C4314B',
    decoration: 'confetti',
    decorationColor: '#C4314B',
    palette: ['#C4314B', '#F4567C', '#F79A3C', '#F6CE45'],
    titleColors: ['#C4314B'],
    layout: 'titleCenter',
    titleStyle: 'script',
    titleColor: '#C4314B',
  },
  {
    id: 'justBecause',
    nameKey: 'justBecause',
    glyph: 'star',
    background: '#3E5BD6',
    backgroundTo: '#2233B0',
    ink: '#F6CE45',
    decoration: 'dots',
    decorationColor: '#F6CE45',
    palette: ['#F6CE45', '#F4567C', '#3FD0C0', '#C9A9F5'],
    titleColors: ['#FFE066', '#FFFFFF'],
    illustration: 'fireworks',
    layout: 'titleTop',
    titleStyle: 'block',
    titleColor: '#FFE066',
  },
  {
    id: 'treatYourself',
    nameKey: 'treatYourself',
    glyph: 'spa',
    background: '#B6E3A6',
    backgroundTo: '#7CC489',
    ink: '#FFFFFF',
    decoration: 'dots',
    decorationColor: '#FFFFFF',
    palette: ['#FFFFFF', '#3FA9A0', '#F6CE45', '#F4567C'],
    titleColors: ['#E0453F', '#FFFFFF'],
    illustration: 'bath',
    layout: 'titleTop',
    titleStyle: 'block',
    titleColor: '#E0453F',
  },
  {
    id: 'giftBox',
    nameKey: 'giftBox',
    glyph: 'gift',
    background: '#FCEFDC',
    backgroundTo: '#F6D6AE',
    ink: '#C4314B',
    decoration: 'checker',
    decorationColor: '#F0A8BC',
    palette: ['#F0A8BC', '#C4314B', '#F79A3C'],
    titleColors: ['#8A3450', '#C4314B'],
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
