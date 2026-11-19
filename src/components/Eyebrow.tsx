// src/components/Eyebrow.tsx
import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, edges, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';

export type EyebrowTone = 'gold' | 'teal' | 'lavender' | 'pink' | 'sky';

interface ToneStyle {
  background: string;
  edge: string;
}

const tones: Record<EyebrowTone, ToneStyle> = {
  get gold() { return { background: colors.creamSoft, edge: edges.gold }; },
  get teal() { return { background: colors.tealTint, edge: edges.teal }; },
  get lavender() { return { background: colors.lavenderTint, edge: edges.lavender }; },
  get pink() { return { background: colors.pinkTint, edge: edges.pink }; },
  get sky() { return { background: colors.skySoft, edge: edges.ink }; },
};

interface EyebrowProps {
  label: string;
  tone?: EyebrowTone;
  style?: StyleProp<ViewStyle>;
}

/**
 * Small uppercase sticker used above a screen title. It mirrors the pill on the
 * marketing site: 2px ink outline, hard bottom edge, pastel fill.
 */
export function Eyebrow({ label, tone = 'gold', style }: EyebrowProps) {
  const palette = tones[tone] ?? tones.gold;
  // Uppercase and wide tracking are Latin-only typography; in Arabic they only
  // stretch the label past its pill.
  const arabic = /[\u0600-\u06FF]/.test(label);
  return (
    <View style={[styles.edge, { backgroundColor: palette.edge }, style]}>
      <View style={[styles.pill, { backgroundColor: palette.background }]}>
        <Text style={[styles.label, arabic && styles.labelArabic]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  edge: {
    alignSelf: 'flex-start',
    // Row layout plus a non-shrinking pill makes the outline hug the label
    // exactly, including Arabic labels that wrap themselves tightly.
    flexDirection: 'row',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingBottom: 3,
  },
  pill: {
    flexShrink: 0,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 5,
  },
  label: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xs,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.text,
  },
  labelArabic: {
    // Figtree has no Arabic glyphs, so the browser substitutes a system font.
    // Dropping the family here keeps layout measurement and rendering on that
    // same font, which is what stops the label overflowing its pill.
    fontFamily: undefined,
    letterSpacing: 0,
    textTransform: 'none',
    fontSize: fontSizes.sm,
  },
}));
