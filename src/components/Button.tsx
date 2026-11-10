// src/components/Button.tsx
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, edges, fonts, fontSizes, radii, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface VariantStyle {
  background: string;
  edge: string;
  border: string;
  label: string;
  spinner: string;
}

const variants: Record<Variant, VariantStyle> = {
  primary: {
    background: colors.teal,
    edge: edges.teal,
    border: colors.ink,
    label: colors.textOnAccent,
    spinner: colors.textOnAccent,
  },
  secondary: {
    background: colors.surface,
    edge: edges.ink,
    border: colors.ink,
    label: colors.ink,
    spinner: colors.ink,
  },
  ghost: {
    background: 'transparent',
    edge: 'transparent',
    border: 'transparent',
    label: colors.ink,
    spinner: colors.ink,
  },
  danger: {
    background: colors.pink,
    edge: edges.pink,
    border: colors.ink,
    label: colors.ink,
    spinner: colors.ink,
  },
};

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const palette = variants[variant];

  return (
    <View
      style={[
        styles.edge,
        {
          backgroundColor: palette.edge,
          borderColor: palette.border,
          paddingBottom: variant === 'ghost' ? 0 : 4,
          borderWidth: variant === 'ghost' ? 0 : 2,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        onPress={isDisabled ? undefined : onPress}
        style={({ pressed }) => [
          styles.base,
          { backgroundColor: palette.background },
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={palette.spinner} />
        ) : (
          <View style={styles.content}>
            <Text style={[styles.label, { color: palette.label }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    borderRadius: radii.pill,
    borderColor: colors.ink,
  },
  base: {
    minHeight: 50,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    letterSpacing: 0.2,
  },
  pressed: { opacity: 0.92, transform: [{ translateY: 3 }] },
  disabled: { opacity: 0.45 },
});
