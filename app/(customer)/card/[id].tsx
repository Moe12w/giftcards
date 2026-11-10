import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Money } from '@/src/components/Money';
import { QRCode } from '@/src/components/QRCode';
import { Screen } from '@/src/components/Screen';
import { getMyCard } from '@/src/lib/data';
import { formatMoney } from '@/src/lib/money';
import type { CardStatus, GiftCard } from '@/src/lib/types';
import { colors, fontSizes, spacing } from '@/src/theme';

const statusTone: Record<CardStatus, BadgeTone> = {
  issued: 'warning',
  claimed: 'success',
  redeemed: 'neutral',
  expired: 'danger',
  voided: 'danger',
};

export default function CardDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<GiftCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!id) return;
    getMyCard(id)
      .then((data) => active && setCard(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!card) {
    return (
      <Screen>
        <FlowHeader title={t('cards.details')} onBack={() => router.back()} />
        <Text style={styles.title}>{t('common.errorGeneric')}</Text>
      </Screen>
    );
  }

  const balance = card.balance_minor ?? card.original_value_minor;
  const canRedeem = card.status === 'claimed' || card.status === 'issued';
  const redeemValue = `giftly:card:${card.id}`;

  function walletUnavailable() {
    Alert.alert(t('cards.addToWallet'), t('cards.walletNotConfigured'));
  }

  return (
    <Screen>
      <FlowHeader title={t('cards.details')} onBack={() => router.back()} />

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.vendor}>{card.vendor_name ?? card.offer_title ?? 'Gift card'}</Text>
          <Badge label={t(`cards.${card.status}`)} tone={statusTone[card.status]} />
        </View>
        <Text style={styles.balanceLabel}>{t('cards.balance')}</Text>
        <Money minor={balance} style={styles.balance} />
        <Text style={styles.expiry}>
          {card.expires_at
            ? t('cards.expires', {
                date: new Date(card.expires_at).toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-QA'),
              })
            : t('cards.noExpiry')}
        </Text>
      </Card>

      {canRedeem ? (
        <Card style={styles.qrCard}>
          <Text style={styles.qrTitle}>{t('cards.showCode')}</Text>
          <QRCode value={redeemValue} />
          <Text style={styles.qrHint}>{t('cards.scanHint')}</Text>
        </Card>
      ) : null}

      <Card style={styles.infoCard}>
        <Row label={t('cards.originalValue')} value={formatMoney(card.original_value_minor, lang)} />
        {card.recipient_name ? <Row label={t('offer.recipientName')} value={card.recipient_name} /> : null}
      </Card>

      <Button label={t('cards.appleWallet')} variant="secondary" onPress={walletUnavailable} />
      <Button label={t('cards.googleWallet')} variant="secondary" onPress={walletUnavailable} />

      <Text style={styles.privacy}>{t('cards.codeOnce')}</Text>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  back: { alignSelf: 'flex-start', paddingVertical: spacing.xs, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSizes.xxl, fontWeight: '700', color: colors.text },
  hero: { gap: spacing.xs, alignItems: 'center' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  vendor: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text, flex: 1 },
  balanceLabel: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.md },
  balance: { fontSize: 44, fontWeight: '800', color: colors.primaryDark },
  expiry: { fontSize: fontSizes.sm, color: colors.textMuted },
  qrCard: { alignItems: 'center', gap: spacing.sm },
  qrTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text },
  qrHint: { fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center' },
  infoCard: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { fontSize: fontSizes.md, color: colors.textMuted },
  rowValue: { fontSize: fontSizes.md, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  privacy: { fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
