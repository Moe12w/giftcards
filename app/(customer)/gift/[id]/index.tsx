import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin, Star, Ticket } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile, type IconTileTone } from '@/src/components/IconTile';
import { ListRow } from '@/src/components/ListRow';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { SponsoredStrip } from '@/src/components/SponsoredCarousel';
import {
  offerBusinessId,
  offerBusinessLogo,
  offerBusinessName,
  offerIcon,
  offerIsFixedAmount,
  offerPackages,
  offerStartingPriceMinor,
  offerTitle,
  offerTone,
} from '@/src/lib/catalog';
import { getOffer } from '@/src/lib/data';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { isSessionOffer } from '@/src/lib/sessions';
import type { AccentTone, Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

export default function GiftDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { update } = useGiftDraft();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) {
      setLoading(false);
      return;
    }
    getOffer(id)
      .then((data) => active && setOffer(data))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <Screen>
        <FlowHeader title={t('gift.detailsTitle')} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <FlowHeader title={t('gift.detailsTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.error.title')}
          body={t('states.error.body')}
          icon="warning"
          tone="pink"
        />
        <Button label={t('common.retry')} onPress={() => router.replace(`/(customer)/gift/${id}`)} />
      </Screen>
    );
  }

  if (!offer) {
    return (
      <Screen>
        <FlowHeader title={t('gift.detailsTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="warning"
          tone="lavender"
        />
      </Screen>
    );
  }

  const title = offerTitle(offer, i18n.language);
  const tone = offerTone(offer) as AccentTone;
  const packages = offerPackages(offer);
  const isExperience = offer.fulfilment_type === 'experience';

  function startGift() {
    if (!offer) return;
    update({
      offerId: offer.id,
      variantId: null,
      amountMinor: isExperience
        ? 0
        : offerIsFixedAmount(offer)
          ? offer.min_amount_minor
          : offer.preset_amounts_minor[1] ?? offer.min_amount_minor,
    });
    router.push(`/(customer)/gift/${offer.id}/design`);
  }

  return (
    <Screen>
      <FlowHeader title={t('gift.detailsTitle')} onBack={() => router.back()} />

      <Card tone={tone === 'sky' ? 'sky' : tone}>
        <View style={styles.heroTop}>
          <IconTile
            icon={offerIcon(offer)}
            imageUrl={offerBusinessLogo(offer)}
            size={72}
            tone={tone as IconTileTone}
          />
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={() => {
                const businessId = offerBusinessId(offer);
                if (businessId) router.push(`/(customer)/business/${businessId}`);
              }}
              accessibilityRole="button"
              accessibilityLabel={offerBusinessName(offer, title)}
              hitSlop={6}
            >
              <Text style={styles.vendor}>{offerBusinessName(offer, title)}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Star size={13} color={colors.gold} />
            <Text style={styles.metaText}>{(offer.rating ?? 4.8).toFixed(1)}</Text>
          </View>
          {offer.location ? (
            <View style={styles.metaPill}>
              <MapPin size={13} color={colors.ink} />
              <Text style={styles.metaText}>{offer.location}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      <SponsoredStrip placementKey="marketplace_sponsored_card" variant="gift_card" limit={3} />

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('gift.about')}</Text>
        <Text style={styles.body}>{offer.description}</Text>
        <View style={styles.amountRow}>
          <Text style={styles.from}>{t('common.from')}</Text>
          <Money minor={offerStartingPriceMinor(offer)} style={styles.amount} />
        </View>
        {isExperience && packages.length > 0 ? (
          <Text style={styles.packageCount}>
            {t('gift.packagesAvailable', { count: packages.length })}
          </Text>
        ) : null}
        {isSessionOffer(offer) ? (
          <Card tone="teal" style={styles.sessionNote}>
            <Ticket size={16} color={colors.ink} />
            <Text style={styles.sessionNoteText}>
              {t('sessions.offerNote', {
                count: packages[0]?.session_count ?? offer.session_count ?? 1,
              })}
            </Text>
          </Card>
        ) : null}
        <Badge
          label={
            offer.valid_until
              ? t('gift.validUntil', {
                  date: new Date(offer.valid_until).toLocaleDateString(
                    i18n.language === 'ar' ? 'ar-QA' : 'en-QA',
                  ),
                })
              : t('gift.noExpiry')
          }
          tone="success"
        />
      </Card>

      <Card style={styles.section}>
        <ListRow
          icon="search"
          tone="teal"
          title={t('gift.terms')}
          onPress={() => router.push(`/(customer)/gift/${offer.id}/terms`)}
        />
        <ListRow
          icon="file"
          tone="lavender"
          title={t('gift.redemption')}
          last
          onPress={() => router.push(`/(customer)/gift/${offer.id}/redemption`)}
        />
      </Card>

      <Button label={t('gift.buyNow')} onPress={startGift} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroCopy: { flex: 1, gap: 2 },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  vendor: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  metaText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.text,
  },
  section: { gap: spacing.sm },  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 21,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: spacing.xs },
  packageCount: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  sessionNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sessionNoteText: { flex: 1, fontSize: fontSizes.sm, color: colors.text, lineHeight: 19 },
  from: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  amount: { fontSize: fontSizes.lg, color: colors.text },
});
