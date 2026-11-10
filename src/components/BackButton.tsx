// src/components/BackButton.tsx
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { colors, radii } from '../theme';

interface BackButtonProps {
  onPress: () => void;
  accessibilityLabel?: string;
}

/** Circular outlined back button; flips direction for Arabic. */
export function BackButton({ onPress, accessibilityLabel }: BackButtonProps) {
  const { i18n, t } = useTranslation();
  const rtl = i18n.language === 'ar';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('common.back')}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {rtl ? <ArrowRight size={22} color={colors.ink} /> : <ArrowLeft size={22} color={colors.ink} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.lavenderTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ translateY: 1 }] },
});
