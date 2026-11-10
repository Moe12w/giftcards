// src/components/SearchBar.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Search } from 'lucide-react-native';
import { colors, fonts, fontSizes, radii, spacing } from '../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** When provided the bar becomes a pressable shortcut instead of an input. */
  onPress?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  style,
  onPress,
}: SearchBarProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={({ pressed }) => [styles.wrapper, style, pressed && styles.pressed]}
      >
        <Search size={20} color={colors.ink} />
        <Text style={[styles.input, styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      <Search size={20} color={colors.ink} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        returnKeyType="search"
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    paddingVertical: spacing.sm,
    textAlign: 'auto',
  },
  placeholder: { color: colors.textMuted },
  pressed: { opacity: 0.85 },
});
