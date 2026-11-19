// src/components/Chip.tsx
import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, edges, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Pill-shaped choice chip, matching the site's filter chips: 2px ink outline,
 *  pastel fill and a hard 2px bottom edge when selected. */
export function Chip({ label, active = false, onPress, style, accessibilityLabel }: ChipProps) {
  return (
    <View style={[styles.edge, active && styles.edgeActive, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={accessibilityLabel ?? label}
        style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
      >
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => ({
  edge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingBottom: 2,
  },
  edgeActive: { backgroundColor: edges.teal },
  chip: {
    borderRadius: radii.pill - 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.teal },
  pressed: { opacity: 0.85 },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  labelActive: { color: colors.textOnAccent },
}));
