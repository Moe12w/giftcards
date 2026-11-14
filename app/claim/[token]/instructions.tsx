import { useThemeRefresh } from '@/src/lib/theme';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function ClaimInstructionsScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();

  return (
    <Screen>
      <Text style={styles.title}>{t('claimExtra.instructionsTitle')}</Text>
      <Card tone="teal">
        <Text style={styles.body}>{t('claimExtra.instructionsBody')}</Text>
      </Card>
      <Button
        label={t('claimExtra.qrTitle')}
        onPress={() => router.push(`/claim/${token}/qr`)}
      />
      <Button
        label={t('claimExtra.addToWallet')}
        variant="secondary"
        onPress={() => router.push(`/claim/${token}/add`)}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    marginTop: spacing.md,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    lineHeight: 22,
  },
}));
