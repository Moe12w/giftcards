// src/theme.ts
// Design tokens for the Gift Card Marketplace.
//
// Visual language: soft cool-grey canvas, white cards with 2px ink outlines and
// a hard 5px bottom edge in the accent's dark tone. Teal is the primary action
// colour, with pink and lavender accents. No soft drop shadows.
//
// Every colour, font, spacing and radius lives here. Screens must not
// hard-code styles.

export const colors = {
  // Canvas
  background: '#EEF0F4',
  backgroundAlt: '#E6E9EF',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F6F8',
  surfaceSunken: '#E3E6EC',

  // Ink & lines
  ink: '#1C1C1C',
  border: '#1C1C1C',
  borderSoft: '#D9DCE2',

  // Text
  text: '#1C1C1C',
  textMuted: '#6E6E6E',
  textOnInk: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  // Primary teal
  primary: '#72C2B8',
  primaryDark: '#4B9C93',
  primaryLight: '#E7F5F3',
  teal: '#72C2B8',
  tealDark: '#4B9C93',
  tealTint: '#E7F5F3',

  // Pink
  pink: '#F4B6B3',
  pinkTint: '#FDEBEA',

  // Lavender
  lavender: '#CDB8F2',
  lavenderCard: '#DCCBF6',
  lavenderTint: '#F2EDFC',
  plum: '#5B4A7E',

  // Accents
  gold: '#F2B233',
  cream: '#F2B233',
  creamSoft: '#FFF4D6',
  sky: '#B9DDFF',
  skySoft: '#E4F2FF',

  // Backwards-compatible aliases used by shared components.
  lilac: '#CDB8F2',
  lilacSoft: '#F2EDFC',
  mint: '#72C2B8',
  mintSoft: '#E7F5F3',

  // Status
  success: '#16805A',
  warning: '#9A6200',
  danger: '#C6363C',
  info: '#2C6BDB',

  // Wallet QR background must stay white in light and dark mode
  qrBackground: '#FFFFFF',

  // Dark mode overrides (applied via useColorScheme in components if needed)
  dark: {
    background: '#14161A',
    surface: '#1E2127',
    surfaceAlt: '#282C33',
    border: '#3C4048',
    text: '#F5F6F8',
    textMuted: '#A6ABB4',
  },
} as const;

// Hard bottom edges for the pressed-sticker look.
export const edges = {
  ink: '#1C1C1C',
  teal: '#4B9C93',
  pink: '#D98F8B',
  lavender: '#A98FD6',
  gold: '#D9A93A',
  white: '#C9CDD4',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  gutter: 16,
} as const;

export const radii = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 32,
  hero: 38,
} as const;

// Figtree is the closest free match to the reference's geometric sans.
// Arabic text falls back to the platform Arabic font automatically.
export const fonts = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
  black: 'Figtree_900Black',
} as const;

export const shadows = {
  none: {},
} as const;

// Two-pixel ink outline used on cards, buttons and inputs.
export const outlines = {
  width: 2,
  color: colors.ink,
} as const;

// Height of the hard bottom edge under cards and buttons.
export const edgeHeight = 5;

export const theme = {
  colors,
  edges,
  spacing,
  radii,
  fontSizes,
  fonts,
  shadows,
  outlines,
  edgeHeight,
};
export default theme;
