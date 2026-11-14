import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { Glyph } from '@/src/components/Glyph';
import { PageHeader } from '@/src/components/PageHeader';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { useCards } from '@/src/lib/cards';
import { useThemeRefresh } from '@/src/lib/theme';
import { isSessionCard } from '@/src/lib/sessions';
import type { CardStatus, GiftCard } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

const statusTone: Record<CardStatus, BadgeTone> = {
  issued: 'warning',
  claimed: 'success',
  redeemed: 'neutral',
  expired: 'danger',
  voided: 'danger',
};

type Filter = 'all' | 'received' | 'sent';

const FILTERS: Filter[] = ['all', 'received', 'sent'];

export default function GiftsScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { ready, cards, receivedCards, sentCards, usableCards, entries, sessionsLeft, valueLeft } =
    useCards();
  const [filter, setFilter] = useState<Filter>('all');

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  const usedCards = useMemo(
    () => cards.filter((card) => card.status === 'redeemed' || card.status === 'expired'),
    [cards],
  );

  const visible = useMemo(() => {
    if (filter === 'received') return receivedCards;
    if (filter === 'sent') return sentCards;
    return cards;
  }, [cards, filter, receivedCards, sentCards]);

  // The customer's own gift cards come first: the ones they can still use.
  const usable = useMemo(
    () => visible.filter((card) => usableCards.some((entry) => entry.id === card.id)),
    [visible, usableCards],
  );
  const used = useMemo(
    () => visible.filter((card) => usedCards.some((entry) => entry.id === card.id)),
    [visible, usedCards],
  );

  function renderCard(card: GiftCard) {
    return (
      <GiftCardVisual
        key={card.id}
        title={card.partner_name ?? card.vendor_name ?? card.offer_title ?? t('gift.detailsTitle')}
        icon={card.icon}
        tone={card.tone}
        amountMinor={valueLeft(card)}
        sessionsTotal={isSessionCard(card) ? card.total_sessions ?? 1 : undefined}
        sessionsRemaining={isSessionCard(card) ? sessionsLeft(card) : undefined}
        message={card.message ?? undefined}
        meta={
          card.expires_at
            ? t('gifts.expiresOn', {
                date: new Date(card.expires_at).toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-QA'),
              })
            : t('cards.noExpiry')
        }
        badge={{ label: t(`cards.${card.status}`), tone: statusTone[card.status] }}
        onPress={() => router.push(`/(customer)/card/${card.id}`)}
      />
    );
  }

  return (
    <Screen tabbed>
      <PageHeader title={t('gifts.title')} subtitle={t('gifts.subtitle')} />

      {!ready ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : (
        <>
          <Card tone="teal" style={styles.summary}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryLabel}>{t('gifts.giftCardsCount')}</Text>
                <Text style={styles.summaryAmount}>{cards.length}</Text>
              </View>
              <View style={styles.summaryIcon}>
                <Glyph name="gift" size={30} />
              </View>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{usableCards.length}</Text>
                <Text style={styles.statLabel}>{t('gifts.toUse')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{sentCards.length}</Text>
                <Text style={styles.statLabel}>{t('gifts.sent')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{usedCards.length}</Text>
                <Text style={styles.statLabel}>{t('gifts.used')}</Text>
              </View>
            </View>
          </Card>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollOuter}
            contentContainerStyle={styles.filterScroll}
          >
            {FILTERS.map((item) => (
              <Chip
                key={item}
                label={t(`gifts.${item}`)}
                active={item === filter}
                onPress={() => setFilter(item)}
              />
            ))}
          </ScrollView>

          {usable.length > 0 ? (
            <>
              <SectionHeader title={t('gifts.yourCards')} />
              <View style={styles.list}>{usable.map(renderCard)}</View>
            </>
          ) : null}

          {used.length > 0 ? (
            <>
              <SectionHeader title={t('gifts.pastCards')} />
              <View style={styles.list}>{used.map(renderCard)}</View>
            </>
          ) : null}

          {usable.length === 0 && used.length === 0 ? (
            <EmptyState
              title={t('gifts.emptyWalletTitle')}
              body={t('gifts.emptyWalletBody')}
              icon="gift"
              tone="teal"
            />
          ) : null}

          {entries.length > 0 ? (
            <>
              <SectionHeader
                title={t('gifts.transactionsTitle')}
                actionLabel={t('common.seeAll')}
                onAction={() => router.push('/(customer)/gifts/transactions')}
              />
              <Card style={styles.transactions}>
                <Text style={styles.transactionsText}>
                  {t('gifts.transactionsCount', { count: entries.length })}
                </Text>
                <Button
                  label={t('gifts.viewTransactions')}
                  variant="secondary"
                  onPress={() => router.push('/(customer)/gifts/transactions')}
                />
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  summary: { gap: spacing.md },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryCopy: { flex: 1, gap: 2 },
  summaryLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  summaryAmount: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.hero,
    color: colors.text,
  },
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
  filterScrollOuter: { marginHorizontal: -spacing.gutter },
  filterScroll: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  loader: { marginVertical: spacing.lg },
  list: { gap: spacing.sm },
  transactions: { gap: spacing.sm },
  transactionsText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
}));
