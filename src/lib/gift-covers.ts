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

/** Resolves a stored cover id, falling back to the first design. */
export function giftCover(id?: string | null): GiftCover {
  return GIFT_COVERS.find((cover) => cover.id === id) ?? GIFT_COVERS[0];
}
