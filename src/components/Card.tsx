// src/components/Card.tsx
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, edgeHeight, edges, radii, spacing } from '../theme';

export type CardTone = 'surface' | 'teal' | 'pink' | 'lavender' | 'gold' | 'sky';

interface ToneStyle {
  background: string;
  edge: string;
}

const tones: Record<CardTone, ToneStyle> = {
  surface: { background: colors.surface, edge: edges.ink },
  teal: { background: colors.tealTint, edge: edges.teal },
  pink: { background: colors.pinkTint, edge: edges.pink },
  lavender: { background: colors.lavenderTint, edge: edges.lavender },
  gold: { background: colors.creamSoft, edge: edges.gold },
  sky: { background: colors.skySoft, edge: edges.ink },
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
  const palette = tones[tone];
  return (
    <View style={[styles.edge, { backgroundColor: edgeColor ?? palette.edge }]}>
      <View style={[styles.card, { backgroundColor: palette.background }, padded && styles.padded, style]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
