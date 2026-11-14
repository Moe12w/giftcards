// src/components/Badge.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  get neutral() { return colors.surface; },
  get success() { return colors.tealTint; },
  get warning() { return colors.creamSoft; },
  get danger() { return colors.pinkTint; },
  get info() { return colors.skySoft; },
  get primary() { return colors.lavenderTint; },
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: tones[tone] ?? tones.neutral }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.ink,
  },
}));
