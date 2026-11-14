// src/theme.ts
// Design tokens for the Gift Card Marketplace.
//
// Visual language: soft cool-grey canvas, white cards with 2px ink outlines and
// a hard 5px bottom edge in the accent's dark tone. Teal is the primary action
// colour, with pink and lavender accents. No soft drop shadows.
//
// Every colour, font, spacing and radius lives here. Screens must not
// hard-code styles.
//
// The app supports a dark theme. `colors` is a live view over the active
// palette, so a colour read while rendering always returns the current theme's
// value. Style blocks that are created once at module load go through
// `themedStyles`, which rebuilds them when the palette changes.

import { StyleSheet } from 'react-native';

const light = {
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
} as const;

export type Palette = { readonly [K in keyof typeof light]: string };

export const lightColors: Palette = light;

export const darkColors: Palette = {
  background: '#14161B',
  backgroundAlt: '#191C22',
  surface: '#1F232B',
  surfaceAlt: '#262A33',
  surfaceSunken: '#101216',

  ink: '#F2F3F5',
  border: '#F2F3F5',
  borderSoft: '#343946',

  text: '#F2F3F5',
  textMuted: '#A7AEBC',
  textOnInk: '#14161B',
  textOnAccent: '#14161B',

  primary: '#7FD1C6',
  primaryDark: '#4B9C93',
  primaryLight: '#1B2C2A',
  teal: '#7FD1C6',
  tealDark: '#4B9C93',
  tealTint: '#1B2C2A',

  pink: '#F4B6B3',
  pinkTint: '#2C1E20',

  lavender: '#CDB8F2',
  lavenderCard: '#2A2340',
  lavenderTint: '#241F33',
  plum: '#CDB8F2',

  gold: '#F2B233',
  cream: '#F2B233',
  creamSoft: '#2B2415',
  sky: '#B9DDFF',
  skySoft: '#16232F',

  lilac: '#CDB8F2',
  lilacSoft: '#241F33',
  mint: '#7FD1C6',
  mintSoft: '#1B2C2A',

  success: '#3FCE9B',
  warning: '#E0A64B',
  danger: '#F07379',
  info: '#6FA8FF',

  qrBackground: '#FFFFFF',
};

const lightEdges = {
  ink: '#1C1C1C',
  teal: '#4B9C93',
  pink: '#D98F8B',
  lavender: '#A98FD6',
  gold: '#D9A93A',
  white: '#C9CDD4',
} as const;

const darkEdges = {
  ink: '#F2F3F5',
  teal: '#4B9C93',
  pink: '#D98F8B',
  lavender: '#A98FD6',
  gold: '#D9A93A',
  white: '#3A3F4A',
} as const;

type Edges = { readonly [K in keyof typeof lightEdges]: string };

// One revision counter for both palettes and their style caches.
let revision = 0;
let activeColors: Palette = lightColors;
let activeEdges: Edges = lightEdges;

/** Switches the palette every `colors`/`edges` read resolves to. */
export function setActivePalette(palette: Palette) {
  activeColors = palette;
  activeEdges = palette === darkColors ? darkEdges : lightEdges;
  revision += 1;
}

export function activePalette() {
  return activeColors;
}

/**
 * The current theme's colours.
 *
 * Reads go through to the active palette instead of being frozen at import
 * time, which is what lets every screen follow the theme switch.
 */
export const colors = new Proxy({} as Palette, {
  get: (_target, key) => activeColors[key as keyof Palette],
  has: (_target, key) => key in activeColors,
  ownKeys: () => Reflect.ownKeys(activeColors),
  getOwnPropertyDescriptor: (_target, key) => ({
    value: activeColors[key as keyof Palette],
    enumerable: true,
    configurable: true,
  }),
});

// Hard bottom edges for the pressed-sticker look.
export const edges = new Proxy({} as Edges, {
  get: (_target, key) => activeEdges[key as keyof Edges],
  has: (_target, key) => key in activeEdges,
  ownKeys: () => Reflect.ownKeys(activeEdges),
  getOwnPropertyDescriptor: (_target, key) => ({
    value: activeEdges[key as keyof Edges],
    enumerable: true,
    configurable: true,
  }),
});

/**
 * A style sheet that is rebuilt whenever the palette changes.
 *
 * `StyleSheet.create({ color: colors.text })` copies the colour once, at
 * import, so it can never follow the theme. Wrapping the block in
 * `themedStyles(() => ({ ... }))` re-evaluates it on the first read after a
 * switch and hands back the cached sheet otherwise.
 */
type StyleRecord = Parameters<typeof StyleSheet.create>[0];

export function themedStyles<S extends StyleRecord>(factory: () => S & StyleRecord): S {
  let cache: S | null = null;
  let builtAt = -1;

  const build = () => {
    if (builtAt !== revision || cache === null) {
      cache = StyleSheet.create(factory());
      builtAt = revision;
    }
    return cache;
  };

  return new Proxy({} as S, {
    get: (_target, key) => (typeof key === 'string' ? (build() as Record<string, unknown>)[key] : undefined),
    has: (_target, key) => key in (build() as object),
    ownKeys: () => Reflect.ownKeys(build() as object),
    getOwnPropertyDescriptor: (_target, key) => {
      const value = (build() as Record<string, unknown>)[key as string];
      return value === undefined
        ? undefined
        : { value, enumerable: true, configurable: true };
    },
  });
}

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
  get color() {
    return colors.ink;
  },
};

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
