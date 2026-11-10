import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { setLanguage, type Language } from '@/src/i18n';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();

  async function choose(language: Language) {
    await setLanguage(language);
    router.back();
  }

  return (
    <Screen>
      <FlowHeader title={t('profile.language')} onBack={() => router.back()} />
      <Text style={styles.body}>{t('profile.languageBody')}</Text>

      <Card style={styles.options}>
        <Button
          label={t('account.english')}
          variant={i18n.language === 'ar' ? 'secondary' : 'primary'}
          onPress={() => choose('en')}
        />
        <Button
          label={t('account.arabic')}
          variant={i18n.language === 'ar' ? 'primary' : 'secondary'}
          onPress={() => choose('ar')}
        />
      </Card>

      <View style={styles.hintBox}>
        <Text style={styles.hint}>{t('account.rtlReloadHint')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.textMuted, lineHeight: 21 },
  options: { gap: spacing.sm },
  hintBox: {
    padding: spacing.sm,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceAlt,
  },
  hint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 17 },
});
