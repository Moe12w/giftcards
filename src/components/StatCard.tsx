// src/components/StatCard.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing } from '../theme';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  label: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted },
  value: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
});
