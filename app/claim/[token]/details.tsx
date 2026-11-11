import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { IconTile } from '@/src/components/IconTile';
import { ListRow } from '@/src/components/ListRow';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { fetchClaimGift, type ClaimGift } from '@/src/lib/claim';
import { formatDate } from '@/src/lib/time';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function ClaimDetailsScreen() {
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
      <Text style={styles.title}>{t('claimExtra.detailsTitle')}</Text>

      <Card tone="teal">
        <View style={styles.row}>
          <IconTile icon="coffee" size={60} tone="gold" />
          <View style={styles.copy}>
            <Text style={styles.vendor}>{gift?.vendor}</Text>
            <Text style={styles.from}>{t('claimExtra.from', { name: gift?.sender ?? '' })}</Text>
          </View>
        </View>
        <Text style={styles.balanceLabel}>{t('gifts.balance')}</Text>
        <Money minor={gift?.remainingValueMinor ?? gift?.amountMinor ?? 0} style={styles.balance} />
        <Text style={styles.expires}>
          {t('claimExtra.expires', { date: formatDate(gift?.expiresAt ?? null, i18n.language) })}
        </Text>
      </Card>

      <Card>
        <Text style={styles.messageLabel}>{t('claimExtra.message')}</Text>
        <Text style={styles.message}>{gift?.message}</Text>
      </Card>

      <Card>
        <ListRow
          icon="coffee"
          tone="teal"
          title={t('claimExtra.qrTitle')}
          onPress={() => router.push(`/claim/${token}/qr`)}
        />
        <ListRow
          icon="camera"
          tone="lavender"
          title={t('claimExtra.instructionsTitle')}
          last
          onPress={() => router.push(`/claim/${token}/instructions`)}
        />
      </Card>

      <Button label={t('claimExtra.addToWallet')} onPress={() => router.push(`/claim/${token}/add`)} />
      <Button
        label={t('claimExtra.qrTitle')}
        variant="secondary"
        onPress={() => router.push(`/claim/${token}/qr`)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    marginTop: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { flex: 1, gap: 1 },
  vendor: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  from: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  balanceLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  balance: { fontSize: fontSizes.hero, color: colors.text },
  expires: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  messageLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
});
