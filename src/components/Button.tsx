// src/components/Button.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, edges, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface VariantStyle {
  background: string;
  edge: string;
  border: string;
  label: string;
  spinner: string;
}

const variants = (): Record<Variant, VariantStyle> => ({
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
});;

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Optional label shown while `loading` is true (e.g. "Signing in…"). */
  loadingLabel?: string;
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
  loadingLabel,
  fullWidth = true,
  style,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const palette = variants()[variant];

  // A soft pulse makes a pending button unmistakable, even when the action
  // finishes in a fraction of a second.
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!loading) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [loading, pulse]);

  const pendingOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

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
          <Animated.View style={[styles.content, { opacity: pendingOpacity }]}>
            <ActivityIndicator color={palette.spinner} />
            <Text style={[styles.label, { color: palette.label }]}>{loadingLabel ?? label}</Text>
          </Animated.View>
        ) : (
          <View style={styles.content}>
            <Text style={[styles.label, { color: palette.label }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => ({
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
}));
