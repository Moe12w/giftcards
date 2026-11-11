import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { QRCode } from '@/src/components/QRCode';
import { Screen } from '@/src/components/Screen';
import { fetchClaimGift, type ClaimGift } from '@/src/lib/claim';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function ClaimQrScreen() {
  const { t } = useTranslation();
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
      <Text style={styles.title}>{t('claimExtra.qrTitle')}</Text>
      <QRCode value={gift?.voucherCode ?? `giftly:redeem:${gift?.voucherId ?? ''}`} />
      <Text style={styles.hint}>{t('cards.scanHint')}</Text>
      <Text style={styles.privacy}>{t('cards.codeOnce')}</Text>
      <Button
        label={t('claimExtra.instructionsTitle')}
        variant="secondary"
        onPress={() => router.push(`/claim/${token}/instructions`)}
      />
      <Button
        label={t('common.back')}
        variant="ghost"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  hint: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.text,
    textAlign: 'center',
  },
  privacy: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
