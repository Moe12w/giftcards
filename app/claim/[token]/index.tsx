import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { IconTile } from '@/src/components/IconTile';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { fetchClaimGift, type ClaimGift } from '@/src/lib/claim';
import { useThemeRefresh } from '@/src/lib/theme';
import { formatDate } from '@/src/lib/time';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';
import { Glyph } from '@/src/components/Glyph';

export default function ClaimLandingScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [gift, setGift] = useState<ClaimGift | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      return;
    }
    fetchClaimGift(token)
      .then((row) => active && setGift(row))
      .catch(() => active && setGift(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);


  if (!token) {
    return (
      <Screen>
        <View style={styles.center}>
          <Glyph name="help" size={40} />
          <Text style={styles.title}>{t('claim.invalidTitle')}</Text>
          <Text style={styles.subtitle}>{t('claim.invalidBody')}</Text>
        </View>
      </Screen>
    );
  }

  if (!loading && !gift) {
    return (
      <Screen>
        <View style={styles.center}>
          <Glyph name="help" size={40} />
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
          <Glyph name="gift" size={44} />
        </View>
        <Text style={styles.title}>{t('claim.title')}</Text>
        <Text style={styles.subtitle}>{t('claim.subtitle', { vendor: gift?.vendor ?? '', amount: '' })}</Text>
      </View>

      <Card tone="teal">
        <View style={styles.vendorRow}>
          <IconTile icon="coffee" size={56} tone="gold" />
          <View style={styles.vendorCopy}>
            <Text style={styles.vendor}>{gift?.vendor}</Text>
            <Text style={styles.from}>{t('claim.from', { name: gift?.sender ?? '' })}</Text>
          </View>
          <Money minor={gift?.amountMinor ?? 0} style={styles.amount} />
        </View>
        <View style={styles.messageBox}>
          <Text style={styles.messageLabel}>{t('claim.messageLabel')}</Text>
          <Text style={styles.message}>{gift?.message}</Text>
        </View>
        <Text style={styles.expires}>
          {t('claim.expires', {
            date: formatDate(gift?.expiresAt ?? null, i18n.language),
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

const styles = themedStyles(() => ({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
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
}));
