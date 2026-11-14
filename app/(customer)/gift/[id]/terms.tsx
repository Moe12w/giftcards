import { useThemeRefresh } from '@/src/lib/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function GiftTermsScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <FlowHeader
        title={t('gift.terms')}
        step={2}
        total={3}
        onBack={() => router.back()}
      />

      <Card>
        <Text style={styles.body}>{t('gift.termsBody')}</Text>
      </Card>

      <View style={styles.ruleRow}>
        <Glyph name="check" size={18} />
        <Text style={styles.ruleText}>{t('gift.redemption')}</Text>
      </View>
      <Button
        label={t('common.continue')}
        onPress={() => router.push(`/(customer)/gift/${id}/design`)}
      />
      <Button
        label={t('gift.redemption')}
        variant="ghost"
        onPress={() => router.push(`/(customer)/gift/${id}/redemption`)}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 22,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ruleText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
}));
