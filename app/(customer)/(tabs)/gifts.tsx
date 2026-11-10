import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { Money } from '@/src/components/Money';
import { PageHeader } from '@/src/components/PageHeader';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { listMyCards } from '@/src/lib/data';
import type { CardStatus, GiftCard } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing } from '@/src/theme';

const statusTone: Record<CardStatus, BadgeTone> = {
  issued: 'warning',
  claimed: 'success',
  redeemed: 'neutral',
  expired: 'danger',
  voided: 'danger',
};

const FILTERS = [
  'all',
  'received',
  'sent',
  'active',
  'scheduled',
  'delivered',
  'opened',
  'redeemed',
  'expired',
] as const;

export default function GiftsScreen() {
  const { t, i18n } = useTranslation();
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listMyCards()
      .then((data) => active && setCards(data))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  const { totalBalance, activeCards, scheduledCards } = useMemo(() => {
    const active = cards.filter((card) => card.status === 'claimed' || card.status === 'issued');
    const scheduled = cards.filter((card) => card.delivery_status === 'scheduled');
    return {
      totalBalance: active.reduce(
        (sum, card) => sum + (card.balance_minor ?? card.original_value_minor),
        0,
      ),
      activeCards: active,
      scheduledCards: scheduled,
    };
  }, [cards]);

  return (
    <Screen tabbed>
      <PageHeader title={t('gifts.title')} subtitle={t('gifts.subtitle')} />

      <Card tone="teal" style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryLabel}>{t('gifts.balance')}</Text>
            <Money minor={totalBalance} style={styles.summaryAmount} />
          </View>
          <View style={styles.summaryIcon}>
            <Text style={styles.summaryEmoji}>💳</Text>
          </View>
        </View>
        <View style={styles.summaryStats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{activeCards.length}</Text>
            <Text style={styles.statLabel}>{t('gifts.active')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{scheduledCards.length}</Text>
            <Text style={styles.statLabel}>{t('gifts.scheduled')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{cards.length}</Text>
            <Text style={styles.statLabel}>{t('gifts.all')}</Text>
          </View>
        </View>
      </Card>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {FILTERS.map((filter) => (
          <Chip
            key={filter}
            label={t(`gifts.${filter}`)}
            onPress={() => router.push(`/(customer)/gifts/${filter}`)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : cards.length === 0 ? (
        <EmptyState
          title={t('gifts.emptyWalletTitle')}
          body={t('gifts.emptyWalletBody')}
          icon="🎁"
          tone="teal"
        />
      ) : (
        <>
          <SectionHeader
            title={t('gifts.active')}
            actionLabel={t('common.seeAll')}
            onAction={() => router.push('/(customer)/gifts/active')}
          />
          <View style={styles.list}>
            {activeCards.slice(0, 3).map((card) => (
              <GiftCardVisual
                key={card.id}
                title={card.vendor_name ?? card.offer_title ?? t('gift.detailsTitle')}
                emoji={card.emoji}
                tone={card.tone}
                amountMinor={card.balance_minor ?? card.original_value_minor}
                message={card.message ?? undefined}
                meta={
                  card.expires_at
                    ? t('gifts.expiresOn', {
                        date: new Date(card.expires_at).toLocaleDateString(
                          lang === 'ar' ? 'ar-QA' : 'en-QA',
                        ),
                      })
                    : t('cards.noExpiry')
                }
                badge={{ label: t(`cards.${card.status}`), tone: statusTone[card.status] }}
                onPress={() => router.push(`/(customer)/card/${card.id}`)}
              />
            ))}
          </View>

          {scheduledCards.length > 0 ? (
            <>
              <SectionHeader
                title={t('gifts.scheduled')}
                actionLabel={t('common.seeAll')}
                onAction={() => router.push('/(customer)/gifts/scheduled')}
              />
              <View style={styles.list}>
                {scheduledCards.map((card) => (
                  <GiftCardVisual
                    key={card.id}
                    title={card.vendor_name ?? card.offer_title ?? t('gift.detailsTitle')}
                    emoji={card.emoji}
                    tone={card.tone}
                    amountMinor={card.original_value_minor}
                    compact
                    meta={
                      card.scheduled_for
                        ? t('gifts.scheduledFor', {
                            date: new Date(card.scheduled_for).toLocaleDateString(
                              lang === 'ar' ? 'ar-QA' : 'en-QA',
                            ),
                          })
                        : undefined
                    }
                    badge={{ label: t('gifts.scheduled'), tone: 'info' }}
                    onPress={() => router.push(`/(customer)/card/${card.id}`)}
                  />
                ))}
              </View>
            </>
          ) : null}

          <SectionHeader
            title={t('orders.title')}
            actionLabel={t('common.seeAll')}
            onAction={() => router.push('/(customer)/(tabs)/orders')}
          />
          <Card style={styles.historyCard}>
            <Badge label={t('gifts.history')} tone="primary" />
            <Text style={styles.historyBody}>{t('gifts.noHistory')}</Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.md },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryCopy: { flex: 1, gap: 2 },
  summaryLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  summaryAmount: { fontSize: fontSizes.hero, color: colors.text },
  summaryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryEmoji: { fontSize: 30 },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  statDivider: { width: 1, height: 28, backgroundColor: colors.borderSoft },
  filterScroll: { gap: spacing.sm, paddingRight: spacing.md },
  loader: { marginVertical: spacing.lg },
  list: { gap: spacing.sm },
  historyCard: { gap: spacing.sm, alignItems: 'flex-start' },
  historyBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
});
