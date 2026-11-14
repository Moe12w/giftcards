// src/components/CollectionTile.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, edges, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { glyphIcon } from '../lib/glyphs';
import type { AccentTone } from '../lib/types';

interface CollectionTileProps {
  label: string;
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  icon?: string;
  tone?: AccentTone;
  onPress?: () => void;
  wide?: boolean;
}

export function CollectionTile({ label, icon, tone = 'lavender', onPress, wide = false }: CollectionTileProps) {
  const Icon = glyphIcon(icon);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.edge,
        { backgroundColor: edgeColors[tone] },
        wide && styles.wide,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.tile, { backgroundColor: backgrounds[tone] }]}>
        <View style={styles.iconWrap}>
          <Icon size={26} color={colors.ink} strokeWidth={2} />
        </View>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const backgrounds: Record<AccentTone, string> = {
  teal: colors.tealTint,
  pink: colors.pinkTint,
  lavender: colors.lavenderTint,
  gold: colors.creamSoft,
  sky: colors.skySoft,
};

const edgeColors: Record<AccentTone, string> = {
  teal: edges.teal,
  pink: edges.pink,
  lavender: edges.lavender,
  gold: edges.gold,
  sky: edges.ink,
};

const styles = themedStyles(() => ({
  edge: {
    flex: 1,
    minWidth: 0,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingBottom: 4,
  },
  wide: { flexBasis: '100%' },
  tile: {
    minHeight: 104,
    borderRadius: radii.md - 2,
    padding: spacing.sm + 2,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  iconWrap: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  pressed: { opacity: 0.85, transform: [{ translateY: 2 }] },
}));
