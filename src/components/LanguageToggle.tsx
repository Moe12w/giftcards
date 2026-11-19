import React from 'react';
import { Alert, Platform, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { setLanguage, type Language } from '@/src/i18n';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

interface LanguageToggleProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * A compact EN / ع switch. It appears on the sign-in screen and in the profile
 * header, so the choice is never buried.
 */
export function LanguageToggle({ style }: LanguageToggleProps) {
  const { t, i18n } = useTranslation();
  const current: Language = i18n.language?.startsWith('ar') ? 'ar' : 'en';

  async function choose(language: Language) {
    if (language === current) return;
    await setLanguage(language);
    if (Platform.OS !== 'web' && language === 'ar') {
      Alert.alert(t('tutorial.languageChanged'), t('account.rtlReloadHint'));
    }
  }

  return (
    <View style={[styles.wrap, style]}>
      {(['en', 'ar'] as const).map((language) => {
        const active = language === current;
        return (
          <Pressable
            key={language}
            onPress={() => choose(language)}
            accessibilityRole="button"
            accessibilityLabel={language === 'en' ? t('account.english') : t('account.arabic')}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {language === 'en' ? 'EN' : 'ع'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 3,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  pill: {
    minWidth: 34,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: colors.teal,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.textOnAccent,
  },
}));
