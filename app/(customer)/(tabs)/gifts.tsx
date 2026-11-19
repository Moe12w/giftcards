import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { BadgeTone } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { PosterCard } from '@/src/components/PosterCard';
import { PageHeader } from '@/src/components/PageHeader';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { ShowMore, usePaged } from '@/src/components/ShowMore';
import { useCards } from '@/src/lib/cards';
import { isGiftWaiting } from '@/src/lib/delivery';
import { cardHref, prefetchCard } from '@/src/lib/navigation';
import { useThemeRefresh } from '@/src/lib/theme';
import { formatDate } from '@/src/lib/time';
import { isSessionCard } from '@/src/lib/sessions';
import type { CardStatus, GiftCard } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

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

  // Gifts bought for a future date are in the wallet but not spendable yet, so
  // they sit in their own section instead of counting as ready to use.
  const waitingGifts = useMemo(() => usable.filter((card) => isGiftWaiting(card)), [usable]);
  const readyGifts = useMemo(() => usable.filter((card) => !isGiftWaiting(card)), [usable]);
  const readyCount = usableCards.filter((card) => !isGiftWaiting(card)).length;

  const waitingPage = usePaged(waitingGifts, 3);
  const readyPage = usePaged(readyGifts, 4);
  const usedPage = usePaged(used, 3);

  function renderCard(card: GiftCard) {
    const isWaiting = isGiftWaiting(card);
    return (
      <GiftCardVisual
        key={card.id}
        title={card.partner_name ?? card.vendor_name ?? card.offer_title ?? t('gift.detailsTitle')}
        icon={card.icon}
        logoUrl={card.image_url}
        tone={card.tone}
        amountMinor={valueLeft(card)}
        sessionsTotal={isSessionCard(card) ? card.total_sessions ?? 1 : undefined}
        sessionsRemaining={isSessionCard(card) ? sessionsLeft(card) : undefined}
        message={card.message ?? undefined}
        meta={
          isWaiting && card.scheduled_for
            ? t('gifts.scheduledFor', { date: formatDate(card.scheduled_for, lang) })
            : card.expires_at
              ? t('gifts.expiresOn', { date: formatDate(card.expires_at, lang) })
              : t('cards.noExpiry')
        }
        badge={
          isWaiting
            ? { label: t('gifts.scheduled'), tone: 'warning' as BadgeTone }
            : { label: t(`cards.${card.status}`), tone: statusTone[card.status] }
        }
        onPressIn={() => prefetchCard(card.id)}
        onPress={() =>
          router.push(
            cardHref({
              id: card.id,
              name: card.partner_name ?? card.vendor_name ?? card.offer_title,
            }) as never,
          )
        }
      />
    );
  }

  return (
    <Screen tabbed>
      <PageHeader title={t('gifts.title')} subtitle={t('gifts.subtitle')} splash />

      {!ready ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : (
        <>
          <PosterCard
            tone="teal"
            tag={t('gifts.title')}
            icon="gift"
            artHeight={100}
            title={String(cards.length)}
            titleStyle={styles.summaryAmount}
            subtitle={t('gifts.giftCardsCount')}
            footer={
              <View style={styles.summaryStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{readyCount}</Text>
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
            }
          />

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

          {waitingGifts.length > 0 ? (
            <>
              <SectionHeader title={t('gifts.waitingSection')} splash />
              <View style={styles.list}>{waitingPage.visible.map(renderCard)}</View>
              {waitingPage.hasMore ? (
                <ShowMore expanded={waitingPage.expanded} onPress={waitingPage.toggle} />
              ) : null}
            </>
          ) : null}

          {readyGifts.length > 0 ? (
            <>
              <SectionHeader title={t('gifts.yourCards')} splash />
              <View style={styles.list}>{readyPage.visible.map(renderCard)}</View>
              {readyPage.hasMore ? (
                <ShowMore expanded={readyPage.expanded} onPress={readyPage.toggle} />
              ) : null}
            </>
          ) : null}

          {used.length > 0 ? (
            <>
              <SectionHeader title={t('gifts.pastCards')} splash />
              <View style={styles.list}>{usedPage.visible.map(renderCard)}</View>
              {usedPage.hasMore ? (
                <ShowMore expanded={usedPage.expanded} onPress={usedPage.toggle} />
              ) : null}
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
  summaryAmount: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.hero,
    color: colors.text,
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
