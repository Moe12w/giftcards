import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/src/components/Screen';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

export default function ProcessingScreen() {
  const { t } = useTranslation();

  useEffect(() => {
    // Payment is confirmed by the MyFatoorah webhook in production. Demo mode
    // always resolves to success after a short simulated delay.
    const timer = setTimeout(() => {
      router.replace('/(customer)/checkout/success');
    }, 1600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.center}>
        <View style={styles.blob} />
        <View style={styles.circle}>
          <ActivityIndicator color={colors.plum} size="large" />
        </View>
        <Text style={styles.title}>{t('checkout.processingTitle')}</Text>
        <Text style={styles.body}>{t('checkout.processingBody')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing.sm },
  blob: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.tealTint,
    transform: [{ translateY: -6 }],
  },
  circle: {
    width: 140,
    height: 140,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
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
  },
});
