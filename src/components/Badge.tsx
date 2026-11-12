// src/components/Badge.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing } from '../theme';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  neutral: colors.surface,
  success: colors.tealTint,
  warning: colors.creamSoft,
  danger: colors.pinkTint,
  info: colors.skySoft,
  primary: colors.lavenderTint,
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: tones[tone] ?? tones.neutral }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
