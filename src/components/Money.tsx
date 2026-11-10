// src/components/Money.tsx
import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/money';
import { colors, fonts, fontSizes } from '../theme';

interface MoneyProps {
  minor: number;
  style?: StyleProp<TextStyle>;
  locale?: 'en' | 'ar';
}

/** Renders a minor-unit amount using the current language. */
export function Money({ minor, style, locale }: MoneyProps) {
  const { i18n } = useTranslation();
  const lang = (locale ?? (i18n.language === 'ar' ? 'ar' : 'en')) as 'en' | 'ar';
  return (
    <Text
      style={[{ fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text }, style]}
      accessibilityLabel={formatMoney(minor, lang)}
    >
      {formatMoney(minor, lang)}
    </Text>
  );
}
