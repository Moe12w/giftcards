import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { BadgeTone } from '@/src/components/Badge';
import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { Screen } from '@/src/components/Screen';
import { ShowMore, usePaged } from '@/src/components/ShowMore';
import { useCards } from '@/src/lib/cards';
import { formatDate } from '@/src/lib/time';
import { useThemeRefresh } from '@/src/lib/theme';
import { isSessionCard } from '@/src/lib/sessions';
import type { GiftCard } from '@/src/lib/types';
import { CARD_STATUS_TONE } from '@/src/lib/status';
import { colors, spacing, themedStyles } from '@/src/theme';

type Filter = 'all' | 'received' | 'sent';

const FILTERS: Filter[] = ['all', 'received', 'sent'];

export default function GiftFilterScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { filter: rawFilter } = useLocalSearchParams<{ filter: string }>();
  const { ready, cards, receivedCards, sentCards, sessionsLeft, valueLeft, reload } = useCards();
  const [filter, setFilter] = useState<Filter>(
    FILTERS.includes(rawFilter as Filter) ? (rawFilter as Filter) : 'all',
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  const visible = useMemo(() => {
    if (filter === 'received') return receivedCards;
    if (filter === 'sent') return sentCards;
    return cards;
  }, [cards, filter, receivedCards, sentCards]);

  const page = usePaged(visible, 4);
  const { reset } = page;
  // Switching filters starts the shorter list again.
  useEffect(() => {
    reset();
  }, [filter, reset]);

  return (
    <Screen>
      <FlowHeader title={t('gifts.title')} onBack={() => router.back()} splash />

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

      {!ready ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('gifts.emptyTitle')}
          body={t('gifts.emptyBody')}
          icon="gift"
          tone="teal"
        />
      ) : (
        <View style={styles.list}>
          {page.visible.map((card: GiftCard) => (
            <GiftCardVisual
              key={card.id}
              title={card.partner_name ?? card.vendor_name ?? card.offer_title ?? t('gift.detailsTitle')}
              icon={card.icon}
              logoUrl={card.image_url}
              tone={card.tone}
              amountMinor={sentCards.some((item) => item.id === card.id) ? undefined : valueLeft(card)}
              sessionsTotal={
                sentCards.some((item) => item.id === card.id)
                  ? undefined
                  : isSessionCard(card)
                    ? card.total_sessions ?? 1
                    : undefined
              }
              sessionsRemaining={
                sentCards.some((item) => item.id === card.id)
                  ? undefined
                  : isSessionCard(card)
                    ? sessionsLeft(card)
                    : undefined
              }
              message={card.message ?? undefined}
              meta={
                card.expires_at
                  ? t('gifts.expiresOn', { date: formatDate(card.expires_at, lang) })
                  : t('cards.noExpiry')
              }
              badge={
                sentCards.some((item) => item.id === card.id)
                  ? { label: t('gifts.sent'), tone: 'primary' as BadgeTone }
                  : { label: t(`cards.${card.status}`), tone: CARD_STATUS_TONE[card.status] }
              }
              onPress={() => router.push(`/(customer)/card/${card.id}`)}
            />
          ))}
        </View>
      )}
      {page.hasMore ? <ShowMore expanded={page.expanded} onPress={page.toggle} /> : null}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  filterScrollOuter: { marginHorizontal: -spacing.gutter },
  filterScroll: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  loader: { marginVertical: spacing.lg },
  list: { gap: spacing.sm },
}));
