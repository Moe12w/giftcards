import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile } from '@/src/components/IconTile';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const STEPS = [
  { emoji: '🔗', key: 'open' },
  { emoji: '📷', key: 'scan' },
  { emoji: '➗', key: 'partial' },
] as const;

export default function GiftRedemptionScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <FlowHeader title={t('gift.redemption')} onBack={() => router.back()} />

      <Card tone="teal">
        <Text style={styles.body}>{t('gift.redemptionBody')}</Text>
      </Card>

      <View style={styles.steps}>
        {STEPS.map((step, index) => (
          <Card key={step.key} style={styles.step}>
            <IconTile emoji={step.emoji} size={46} tone="lavender" />
            <View style={styles.stepCopy}>
              <Text style={styles.stepIndex}>{index + 1}</Text>
              <Text style={styles.stepText}>{t(`claimExtra.instructionsTitle`)}</Text>
            </View>
          </Card>
        ))}
      </View>

      <Button
        label={t('gift.buyNow')}
        onPress={() => router.push(`/(customer)/gift/${id}/design`)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    lineHeight: 22,
  },
  steps: { gap: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepCopy: { flex: 1, gap: 2 },
  stepIndex: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xs,
    color: colors.tealDark,
  },
  stepText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
});
