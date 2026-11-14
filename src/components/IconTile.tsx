// src/components/IconTile.tsx
import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { glyphIcon } from '../lib/glyphs';
import { colors, radii, themedStyles } from '../theme';

export type IconTileTone = 'lilac' | 'lavender' | 'teal' | 'pink' | 'gold' | 'sky' | 'surface';

const tones: Record<IconTileTone, string> = {
  get lilac() { return colors.lavender; },
  get lavender() { return colors.lavender; },
  get teal() { return colors.teal; },
  get pink() { return colors.pink; },
  get gold() { return colors.gold; },
  get sky() { return colors.sky; },
  get surface() { return colors.surface; },
};

interface IconTileProps {
  /** Semantic glyph key — rendered as an outline icon when there is no logo. */
  icon?: string | null;
  /** Vendor logo image URL — renders the logo instead of the glyph when present. */
  imageUrl?: string | null;
  size?: number;
  tone?: IconTileTone;
  style?: StyleProp<ViewStyle>;
}

/** Rounded pastel tile with an ink outline, used for offer and list artwork. */
export function IconTile({ icon, imageUrl, size = 64, tone = 'lavender', style }: IconTileProps) {
  const Icon = glyphIcon(icon);
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Math.max(radii.sm, size * 0.3),
          backgroundColor: tones[tone] ?? tones.lavender,
        },
        style,
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
      ) : (
        <Icon size={size * 0.48} color={colors.ink} strokeWidth={2} />
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  tile: {
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 44, height: 44 },
}));
