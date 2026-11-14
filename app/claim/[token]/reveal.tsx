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

export default function ClaimRevealScreen() {
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


  return (
    <Screen>
      <View style={styles.hero}>
        <Glyph name="star" size={22} color={colors.pink} style={styles.sparkleA} />
        <Glyph name="star" size={16} color={colors.gold} style={styles.sparkleB} />
        <Glyph name="star" size={12} color={colors.teal} style={styles.sparkleC} />
        <Text style={styles.heroTitle}>{t('claimExtra.revealTitle')}</Text>
      </View>

      <Card tone="lavender" style={styles.card}>
        <IconTile icon="coffee" size={68} tone="gold" />
        <Text style={styles.vendor}>{gift?.vendor}</Text>
        <Money minor={gift?.amountMinor ?? 0} style={styles.amount} />
        <Text style={styles.from}>{t('claimExtra.from', { name: gift?.sender ?? '' })}</Text>
        <View style={styles.messageBox}>
          <Text style={styles.messageLabel}>{t('claimExtra.message')}</Text>
          <Text style={styles.message}>{gift?.message}</Text>
        </View>
        <Text style={styles.expires}>
          {t('claimExtra.expires', { date: formatDate(gift?.expiresAt ?? null, i18n.language) })}
        </Text>
      </Card>

      <Button
        label={t('claimExtra.openCta')}
        onPress={() => router.push(`/claim/${token}/details`)}
      />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  hero: { alignItems: 'center', marginTop: spacing.md },
  heroTitle: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
  },
  sparkleA: { position: 'absolute', top: -4, left: '24%', fontSize: 20, color: colors.ink },
  sparkleB: { position: 'absolute', top: 14, right: '24%', fontSize: 14, color: colors.ink },
  sparkleC: { position: 'absolute', top: -10, right: '38%', fontSize: 12, color: colors.ink },
  card: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  vendor: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.text },
  amount: { fontSize: fontSizes.hero, color: colors.text },
  from: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  messageBox: {
    alignSelf: 'stretch',
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
}));
