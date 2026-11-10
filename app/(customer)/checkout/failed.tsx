import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

export default function CheckoutFailedScreen() {
  const { t } = useTranslation();

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.blob} />
        <View style={styles.circle}>
          <Text style={styles.emoji}>💳</Text>
        </View>
        <Text style={styles.title}>{t('checkout.failedTitle')}</Text>
        <Text style={styles.body}>{t('checkout.failedBody')}</Text>
      </View>

      <View style={styles.footer}>
        <Button
          label={t('checkout.tryAgain')}
          onPress={() => router.replace('/(customer)/checkout/payment')}
        />
        <Button
          label={t('checkout.backHome')}
          variant="secondary"
          onPress={() => router.replace('/(customer)/(tabs)')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  blob: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.pinkTint,
  },
  circle: {
    width: 150,
    height: 150,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emoji: { fontSize: 68 },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: { gap: spacing.sm },
});
