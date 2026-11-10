import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { IconTile } from '@/src/components/IconTile';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { DEMO_CLAIM } from '@/src/lib/claim';
import { formatDate } from '@/src/lib/time';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

export default function ClaimLandingScreen() {
  const { t, i18n } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();

  if (!token) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.icon}>😕</Text>
          <Text style={styles.title}>{t('claim.invalidTitle')}</Text>
          <Text style={styles.subtitle}>{t('claim.invalidBody')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.blob} />
        <View style={styles.heroCircle}>
          <Text style={styles.heroEmoji}>🎁</Text>
        </View>
        <Text style={styles.title}>{t('claim.title')}</Text>
        <Text style={styles.subtitle}>{t('claim.subtitle', { vendor: DEMO_CLAIM.vendor, amount: '' })}</Text>
      </View>

      <Card tone="teal">
        <View style={styles.vendorRow}>
          <IconTile emoji="☕" size={56} tone="gold" />
          <View style={styles.vendorCopy}>
            <Text style={styles.vendor}>{DEMO_CLAIM.vendor}</Text>
            <Text style={styles.from}>{t('claim.from', { name: DEMO_CLAIM.sender })}</Text>
          </View>
          <Money minor={DEMO_CLAIM.amountMinor} style={styles.amount} />
        </View>
        <View style={styles.messageBox}>
          <Text style={styles.messageLabel}>{t('claim.messageLabel')}</Text>
          <Text style={styles.message}>{DEMO_CLAIM.message}</Text>
        </View>
        <Text style={styles.expires}>
          {t('claim.expires', {
            date: formatDate(DEMO_CLAIM.expiresAt, i18n.language),
          })}
        </Text>
      </Card>

      <Button
        label={t('claimExtra.openCta')}
        onPress={() => router.push(`/claim/${token}/open`)}
      />
      <Text style={styles.note}>{t('claimExtra.noAccountNeeded')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  icon: { fontSize: 56 },
  hero: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg },
  blob: {
    position: 'absolute',
    top: -6,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.pinkTint,
  },
  heroCircle: {
    width: 110,
    height: 110,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroEmoji: { fontSize: 56 },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.display,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vendorCopy: { flex: 1, gap: 1 },
  vendor: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  from: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  amount: { fontSize: fontSizes.xl, color: colors.text },
  messageBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    gap: 2,
  },
  messageLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  message: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.text, lineHeight: 21 },
  expires: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  note: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
