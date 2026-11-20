import React from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Screen } from '@/src/components/Screen';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

/**
 * Giftly does not store payment instruments. Card details are typed on the
 * MyFatoorah hosted page during checkout, so this screen explains that instead
 * of listing placeholder cards.
 */
export default function PaymentMethodsScreen() {
  useThemeRefresh();
  const { t } = useTranslation();

  return (
    <Screen>
      <FlowHeader title={t('profile.paymentMethods')} onBack={() => router.back()} />

      <Card style={styles.note}>
        <Text style={styles.title}>{t('profile.paymentMethodsTitle')}</Text>
        <Text style={styles.body}>{t('profile.paymentMethodsInfo')}</Text>
      </Card>

      <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  note: { gap: spacing.xs },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
}));
