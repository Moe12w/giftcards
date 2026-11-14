// src/components/Avatar.tsx
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radii, themedStyles } from '../theme';
import { Glyph } from './Glyph';

interface AvatarProps {
  name?: string | null;
  size?: number;
  tone?: 'teal' | 'pink' | 'lavender' | 'gold';
  style?: StyleProp<ViewStyle>;
}

const tones = {
  get teal() { return colors.teal; },
  get pink() { return colors.pink; },
  get lavender() { return colors.lavender; },
  get gold() { return colors.gold; },
} as const;

export function Avatar({ name, size = 48, tone = 'lavender', style }: AvatarProps) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: radii.pill,
          backgroundColor: tones[tone] ?? tones.teal,
        },
        style,
      ]}
    >
      {initial ? (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
      ) : (
        <Glyph name="gift" size={size * 0.44} />
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  avatar: {
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.extrabold, color: colors.ink },
}));
