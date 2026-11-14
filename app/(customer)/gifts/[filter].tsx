import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { Screen } from '@/src/components/Screen';
import { useCards } from '@/src/lib/cards';
import { useThemeRefresh } from '@/src/lib/theme';
import { isSessionCard } from '@/src/lib/sessions';
import type { CardStatus, GiftCard } from '@/src/lib/types';
import { colors, spacing, themedStyles } from '@/src/theme';

const statusTone: Record<CardStatus, BadgeTone> = {
  issued: 'warning',
  claimed: 'success',
  redeemed: 'neutral',
  expired: 'danger',
  voided: 'danger',
};

type Filter = 'all' | 'received' | 'sent';

const FILTERS: Filter[] = ['all', 'received', 'sent'];

export default function GiftFilterScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { filter: rawFilter } = useLocalSearchParams<{ filter: string }>();
  const { ready, cards, receivedCards, sentCards, sessionsLeft, valueLeft } = useCards();
  const [filter, setFilter] = useState<Filter>(
    FILTERS.includes(rawFilter as Filter) ? (rawFilter as Filter) : 'all',
  );

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  const visible = useMemo(() => {
    if (filter === 'received') return receivedCards;
    if (filter === 'sent') return sentCards;
    return cards;
  }, [cards, filter, receivedCards, sentCards]);

  return (
    <Screen>
      <FlowHeader title={t('gifts.title')} onBack={() => router.back()} />

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
          {visible.map((card: GiftCard) => (
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
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  filterScrollOuter: { marginHorizontal: -spacing.gutter },
  filterScroll: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  loader: { marginVertical: spacing.lg },
  list: { gap: spacing.sm },
}));
