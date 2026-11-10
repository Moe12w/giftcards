// src/components/ProgressDots.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../theme';

interface ProgressDotsProps {
  count: number;
  active: number;
}

export function ProgressDots({ count, active }: ProgressDotsProps) {
  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[styles.dot, index === active ? styles.dotActive : styles.dotIdle]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { height: 8, borderRadius: radii.pill },
  dotActive: { width: 26, backgroundColor: colors.teal },
  dotIdle: { width: 8, backgroundColor: colors.borderSoft },
});
