// src/components/Card.tsx
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, edgeHeight, edges, radii, spacing, themedStyles } from '../theme';

export type CardTone = 'surface' | 'teal' | 'pink' | 'lavender' | 'gold' | 'sky';

interface ToneStyle {
  background: string;
  edge: string;
}

const tones: Record<CardTone, ToneStyle> = {
  get surface() { return { background: colors.surface, edge: edges.ink }; },
  get teal() { return { background: colors.tealTint, edge: edges.teal }; },
  get pink() { return { background: colors.pinkTint, edge: edges.pink }; },
  get lavender() { return { background: colors.lavenderTint, edge: edges.lavender }; },
  get gold() { return { background: colors.creamSoft, edge: edges.gold }; },
  get sky() { return { background: colors.skySoft, edge: edges.ink }; },
};

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  tone?: CardTone;
  /** Overrides the hard bottom edge colour. */
  edgeColor?: string;
}

/**
 * White or pastel card with a 2px ink outline and a hard 5px bottom edge.
 * `style` applies to the card surface so existing row/gap styles keep working.
 */
export function Card({ children, style, padded = true, tone = 'surface', edgeColor }: CardProps) {
  // An unknown tone must never take the screen down.
  const palette = tones[tone] ?? tones.surface;
  return (
    <View style={[styles.edge, { backgroundColor: edgeColor ?? palette.edge }]}>
      <View style={[styles.card, { backgroundColor: palette.background }, padded && styles.padded, style]}>
        {children}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  edge: {
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingBottom: edgeHeight,
  },
  card: {
    borderRadius: radii.lg - 2,
    overflow: 'hidden',
  },
  padded: { padding: spacing.md },
}));
