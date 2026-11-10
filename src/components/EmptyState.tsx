// src/components/EmptyState.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes, spacing } from '../theme';
import { IconTile, type IconTileTone } from './IconTile';

interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: string;
  tone?: IconTileTone;
}

export function EmptyState({ title, body, icon = '✦', tone = 'lilac' }: EmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <IconTile emoji={icon} size={88} tone={tone} />
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
