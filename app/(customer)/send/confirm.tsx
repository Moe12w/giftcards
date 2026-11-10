import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile } from '@/src/components/IconTile';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { offerIcon, offerTitle, offerTone } from '@/src/lib/catalog';
import { getOffer } from '@/src/lib/data';
import { useGiftDraft } from '@/src/lib/gift-draft';
import type { AccentTone, Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function SendConfirmScreen() {
  const { t, i18n } = useTranslation();
  const { draft } = useGiftDraft();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!draft.offerId) {
      setLoading(false);
      return;
    }
    getOffer(draft.offerId)
      .then((data) => active && setOffer(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [draft.offerId]);

  if (loading) {
    return (
      <Screen>
        <FlowHeader title={t('send.confirmTitle')} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!offer) {
    return (
      <Screen>
        <FlowHeader title={t('send.confirmTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="gift"
          tone="lavender"
        />
      </Screen>
    );
  }

  const tone = offerTone(offer) as AccentTone;

  return (
    <Screen>
      <FlowHeader
        title={t('send.confirmTitle')}
        subtitle={t('send.confirmSubtitle')}
        onBack={() => router.back()}
      />

      <Card tone={tone === 'sky' ? 'sky' : tone}>
        <View style={styles.offerRow}>
          <IconTile icon={offerIcon(offer)} size={56} tone={tone === 'sky' ? 'sky' : tone} />
          <View style={styles.offerCopy}>
            <Text style={styles.offerTitle}>{offerTitle(offer, i18n.language)}</Text>
            <Text style={styles.offerVendor}>{offer.vendor?.name ?? ''}</Text>
          </View>
          <Money minor={draft.amountMinor} style={styles.offerAmount} />
        </View>
      </Card>

      <Card style={styles.details}>
        <Row label={t('send.recipientTitle')} value={draft.recipient?.name ?? '—'} />
        <Row label={t('send.recipientEmail')} value={draft.recipient?.email ?? '—'} />
        <Row
          label={t('send.deliveryTitle')}
          value={t(`send.delivery${draft.deliveryMethod === 'email' ? 'Email' : draft.deliveryMethod === 'sms' ? 'Sms' : 'Link'}`)}
        />
        <Row
          label={t('send.deliveryDate')}
          value={
            draft.deliveryDate
              ? new Date(draft.deliveryDate).toLocaleDateString(
                  i18n.language === 'ar' ? 'ar-QA' : 'en-QA',
                )
              : t('send.deliveryNow')
          }
        />
        {draft.message ? <Row label={t('send.messageTitle')} value={draft.message} /> : null}
      </Card>

      <Button
        label={t('send.confirmCta')}
        onPress={() => router.push('/(customer)/checkout/payment')}
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offerCopy: { flex: 1, gap: 1 },
  offerTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  offerVendor: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  offerAmount: { fontSize: fontSizes.lg, color: colors.text },
  details: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  rowValue: {
    flexShrink: 1,
    maxWidth: '62%',
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
    textAlign: 'right',
  },
});
