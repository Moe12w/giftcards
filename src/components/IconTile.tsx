// src/components/IconTile.tsx
import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from '../theme';

export type IconTileTone = 'lilac' | 'lavender' | 'teal' | 'pink' | 'gold' | 'sky' | 'surface';

const tones: Record<IconTileTone, string> = {
  lilac: colors.lavender,
  lavender: colors.lavender,
  teal: colors.teal,
  pink: colors.pink,
  gold: colors.gold,
  sky: colors.sky,
  surface: colors.surface,
};

interface IconTileProps {
  emoji?: string;
  /** Vendor logo image URL — renders the logo instead of the emoji when present. */
  imageUrl?: string | null;
  size?: number;
  tone?: IconTileTone;
  style?: StyleProp<ViewStyle>;
}

/** Rounded pastel tile with an ink outline, used for offer and list artwork. */
export function IconTile({ emoji, imageUrl, size = 64, tone = 'lavender', style }: IconTileProps) {
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Math.max(radii.sm, size * 0.3),
          backgroundColor: tones[tone],
        },
        style,
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
      ) : (
        <Text style={{ fontSize: size * 0.46 }}>{emoji ?? '🎁'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 44, height: 44 },
});
