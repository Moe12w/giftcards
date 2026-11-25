import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { GiftCoverCard } from '@/src/components/GiftCoverCard';
import { GiftMediaView } from '@/src/components/GiftMediaView';
import { Screen } from '@/src/components/Screen';
import { coverLabel, fetchGiftCovers, GIFT_COVERS, resolveCover, type GiftCover } from '@/src/lib/gift-covers';
import { getOffer } from '@/src/lib/data';
import { useThemeRefresh } from '@/src/lib/theme';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { offerTitle } from '@/src/lib/catalog';
import type { Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function SendPreviewScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { draft } = useGiftDraft();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [covers, setCovers] = useState<GiftCover[]>(GIFT_COVERS);
  // No id means there is nothing to fetch: start settled rather than
  // flipping the flag from inside the effect.
  const [loading, setLoading] = useState(!draft.offerId);

  useEffect(() => {
    let active = true;
    if (!draft.offerId) return;
    getOffer(draft.offerId)
      .then((data) => active && setOffer(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [draft.offerId]);

  useEffect(() => {
    let active = true;
    fetchGiftCovers().then((items) => active && setCovers(items));
    return () => {
      active = false;
    };
  }, []);

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
        <Button label={t('home.quickSend')} onPress={() => router.replace('/(customer)/send/recipient')} />
      </Screen>
    );
  }

  const title = offerTitle(offer, i18n.language);
  const selectedCover = resolveCover(draft.cover, covers);
  const coverName = coverLabel(selectedCover, t);
  const media = draft.media && draft.media.type !== 'sticker' ? draft.media : null;

  return (
    <Screen>
      <FlowHeader
        title={t('send.previewTitle')}
        subtitle={t('send.previewSubtitle')}
        onBack={() => router.back()}
      />

      <GiftCoverCard
        coverId={draft.cover}
        coverImageUrl={selectedCover.imageUrl}
        coverName={coverName}
        stickerId={draft.media?.type === 'sticker' ? draft.media.stickerId : null}
        photoUri={draft.media?.type === 'photo' ? draft.media.uri : null}
        message={draft.message || undefined}
        title={title}
        amountMinor={draft.amountMinor}
      />

      {media ? <GiftMediaView media={media} height={160} /> : null}

      <Card style={styles.summary}>
        <Row label={t('send.recipientTitle')} value={draft.recipient?.name ?? '—'} />
        <Row label={t('send.deliveryTitle')} value={t(`send.delivery${capitalize(draft.deliveryMethod)}`)} />
        <Row label={t('send.cover')} value={coverName} />
        <Row label={t('send.theme')} value={t(`send.themes.${draft.theme}`)} />
        <Row label={t('send.wrapping')} value={t(`send.wrappings.${draft.wrapping}`)} />
      </Card>

      <Button label={t('send.edit')} variant="secondary" onPress={() => router.back()} />
      <Button
        label={t('common.continue')}
        onPress={() => router.push('/(customer)/checkout/payment')}
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
