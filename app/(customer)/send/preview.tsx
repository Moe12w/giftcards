import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { Screen } from '@/src/components/Screen';
import { getOffer } from '@/src/lib/data';
import { useThemeRefresh } from '@/src/lib/theme';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { offerIcon, offerTitle, offerTone } from '@/src/lib/catalog';
import type { Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function SendPreviewScreen() {
  useThemeRefresh();
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
        <FlowHeader title={t('send.previewTitle')} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!offer) {
    return (
      <Screen>
        <FlowHeader title={t('send.previewTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="gift"
          tone="lavender"
        />
        <Button label={t('home.quickSend')} onPress={() => router.replace('/(customer)/(tabs)/send')} />
      </Screen>
    );
  }

  const title = offerTitle(offer, i18n.language);

  return (
    <Screen>
      <FlowHeader
        title={t('send.previewTitle')}
        subtitle={t('send.previewSubtitle')}
        onBack={() => router.back()}
      />

      <GiftCardVisual
        title={title}
        icon={offerIcon(offer)}
        tone={offerTone(offer)}
        amountMinor={draft.amountMinor}
        message={draft.message || undefined}
        meta={
          draft.recipient
            ? `${t('send.recipientTitle')}: ${draft.recipient.name}`
            : undefined
        }
      />

      <Card style={styles.summary}>
        <Row label={t('send.recipientTitle')} value={draft.recipient?.name ?? '—'} />
        <Row label={t('send.deliveryTitle')} value={t(`send.delivery${capitalize(draft.deliveryMethod)}`)} />
        <Row label={t('send.theme')} value={t(`send.themes.${draft.theme}`)} />
        <Row label={t('send.wrapping')} value={t(`send.wrappings.${draft.wrapping}`)} />
      </Card>

      <Button label={t('send.edit')} variant="secondary" onPress={() => router.back()} />
      <Button
        label={t('common.continue')}
        onPress={() => router.push('/(customer)/send/confirm')}
      />
    </Screen>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  loader: { marginTop: spacing.xxl },
  summary: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
    textAlign: 'right',
  },
}));
