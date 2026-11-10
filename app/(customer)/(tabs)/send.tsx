import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/src/components/Avatar';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Money } from '@/src/components/Money';
import { OfferCard } from '@/src/components/OfferCard';
import { PageHeader } from '@/src/components/PageHeader';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { OCCASIONS, offerTitle } from '@/src/lib/catalog';
import { listActiveOffers } from '@/src/lib/data';
import { useGiftDraft } from '@/src/lib/gift-draft';
import { MOCK_RECIPIENTS } from '@/src/lib/mock-data';
import type { Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

export default function SendScreen() {
  const { t, i18n } = useTranslation();
  const { draft, update } = useGiftDraft();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listActiveOffers()
      .then((data) => active && setOffers(data))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const draftOffer = offers.find((offer) => offer.id === draft.offerId) ?? null;

  function chooseRecipient(recipient: (typeof MOCK_RECIPIENTS)[number]) {
    update({ recipient });
    router.push('/(customer)/collection/trending');
  }

  return (
    <Screen tabbed>
      <PageHeader title={t('send.title')} subtitle={t('send.subtitle')} />

      <Card tone="teal" style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCircle}>
            <Text style={styles.heroEmoji}>🎁</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{t('onboarding.personalize.title')}</Text>
            <Text style={styles.heroBody}>{t('onboarding.personalize.body')}</Text>
          </View>
        </View>
        <Button
          label={t('send.start')}
          onPress={() => router.push('/(customer)/collection/trending')}
        />
      </Card>

      {draftOffer ? (
        <Card tone="lavender" style={styles.draftCard}>
          <View style={styles.draftRow}>
            <View style={styles.draftCopy}>
              <Text style={styles.draftLabel}>{t('send.previewTitle')}</Text>
              <Text style={styles.draftTitle} numberOfLines={1}>
                {offerTitle(draftOffer, i18n.language)}
              </Text>
              {draft.amountMinor > 0 ? (
                <Money minor={draft.amountMinor} style={styles.draftAmount} />
              ) : null}
            </View>
            <Button
              label={t('common.continue')}
              fullWidth={false}
              style={styles.draftButton}
              onPress={() =>
                router.push(draft.recipient ? '/(customer)/send/delivery' : '/(customer)/send/recipient')
              }
            />
          </View>
        </Card>
      ) : null}

      {draft.basketCode ? (
        <Card tone="teal" style={styles.basketBanner}>
          <Text style={styles.basketBannerLabel}>{t('giftBasket.join')}</Text>
          <Text style={styles.basketBannerCode}>{draft.basketCode}</Text>
        </Card>
      ) : null}

      <SectionHeader title={t('send.recipientTitle')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recipientScroll}
      >
        {MOCK_RECIPIENTS.map((recipient) => (
          <Pressable
            key={recipient.id}
            onPress={() => chooseRecipient(recipient)}
            accessibilityRole="button"
            accessibilityLabel={recipient.name}
            style={({ pressed }) => [styles.recipient, pressed && styles.pressed]}
          >
            <Avatar name={recipient.name} size={56} tone="lavender" />
            <Text style={styles.recipientName} numberOfLines={1}>
              {recipient.name.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => router.push('/(customer)/send/recipient-details')}
          accessibilityRole="button"
          accessibilityLabel={t('send.addRecipient')}
          style={({ pressed }) => [styles.recipient, pressed && styles.pressed]}
        >
          <View style={styles.addCircle}>
            <Text style={styles.addPlus}>+</Text>
          </View>
          <Text style={styles.recipientName} numberOfLines={1}>
            {t('send.addRecipient')}
          </Text>
        </Pressable>
      </ScrollView>

      <SectionHeader
        title={t('explore.occasions')}
        actionLabel={t('common.seeAll')}
        onAction={() => router.push('/(customer)/collection/birthday')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScroll}
      >
        {OCCASIONS.map((occasion) => (
          <Pressable
            key={occasion.slug}
            onPress={() => router.push(`/(customer)/collection/${occasion.slug}`)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.occasionChip, pressed && styles.pressed]}
          >
            <Text style={styles.occasionEmoji}>{occasion.emoji}</Text>
            <Text style={styles.occasionLabel}>{t(occasion.titleKey)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeader
        title={t('explore.popular')}
        actionLabel={t('common.seeAll')}
        onAction={() => router.push('/(customer)/collection/popular')}
      />
      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : (
        <View style={styles.list}>
          {offers.slice(0, 3).map((offer, index) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              index={index}
              onPress={() => router.push(`/(customer)/gift/${offer.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroCircle: {
    width: 84,
    height: 84,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 42 },
  heroCopy: { flex: 1, gap: 2 },
  heroTitle: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  heroBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 19,
  },
  draftCard: { gap: spacing.sm },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  draftCopy: { flex: 1, gap: 2 },
  draftLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  draftTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  draftAmount: { fontSize: fontSizes.md, color: colors.text },
  draftButton: { paddingHorizontal: spacing.md },
  recipientScroll: { gap: spacing.md, paddingRight: spacing.md },
  recipient: { alignItems: 'center', gap: 4, width: 68 },
  recipientName: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.text,
    textAlign: 'center',
  },
  addCircle: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  chipScroll: { gap: spacing.sm, paddingRight: spacing.md },
  occasionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  occasionEmoji: { fontSize: 16 },
  occasionLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  list: { gap: spacing.sm },
  loader: { marginVertical: spacing.lg },
  basketBanner: { gap: 2, alignItems: 'flex-start' },
  basketBannerLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  basketBannerCode: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  pressed: { opacity: 0.85 },
});
