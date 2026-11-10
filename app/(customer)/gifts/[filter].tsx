import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { Screen } from '@/src/components/Screen';
import { useCards } from '@/src/lib/cards';
import { isSessionCard } from '@/src/lib/sessions';
import type { GiftCard } from '@/src/lib/types';
import { colors, spacing } from '@/src/theme';

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

type Filter = (typeof FILTERS)[number];

function matches(card: GiftCard, filter: Filter): boolean {
  switch (filter) {
    case 'received':
      return Boolean(card.claimed_by);
    case 'sent':
      return Boolean(card.buyer_id);
    case 'active':
      return card.status === 'claimed' || card.status === 'issued';
    case 'scheduled':
      return card.delivery_status === 'scheduled';
    case 'delivered':
      return card.delivery_status === 'delivered' || card.delivery_status === 'opened';
    case 'opened':
      return card.delivery_status === 'opened';
    case 'redeemed':
      return card.status === 'redeemed';
    case 'expired':
      return card.status === 'expired';
    default:
      return true;
  }
}

export default function GiftFilterScreen() {
  const { t, i18n } = useTranslation();
  const { filter: rawFilter } = useLocalSearchParams<{ filter: string }>();
  const filter = (FILTERS.includes(rawFilter as Filter) ? rawFilter : 'all') as Filter;
  const { ready, myCards: cards, sessionsLeft, valueLeft } = useCards();
  const loading = !ready;

  const results = useMemo(() => cards.filter((card) => matches(card, filter)), [cards, filter]);

  return (
    <Screen>
      <FlowHeader title={t('gifts.title')} onBack={() => router.back()} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((item) => (
          <Chip
            key={item}
            label={t(`gifts.${item}`)}
            active={item === filter}
            onPress={() => router.setParams({ filter: item })}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : results.length === 0 ? (
        <EmptyState
          title={t('gifts.emptyTitle')}
          body={t('gifts.emptyBody')}
          icon="gift"
          tone="teal"
        />
      ) : (
        <View style={styles.list}>
          {results.map((card) => (
            <GiftCardVisual
              key={card.id}
              title={card.vendor_name ?? card.offer_title ?? t('gift.detailsTitle')}
              icon={card.icon}
              tone={card.tone}
              amountMinor={valueLeft(card)}
              sessionsTotal={isSessionCard(card) ? card.sessions_total ?? 1 : undefined}
              sessionsRemaining={isSessionCard(card) ? sessionsLeft(card) : undefined}
              message={card.message ?? undefined}
              meta={
                card.expires_at
                  ? t('gifts.expiresOn', {
                      date: new Date(card.expires_at).toLocaleDateString(
                        i18n.language === 'ar' ? 'ar-QA' : 'en-QA',
                      ),
                    })
                  : t('cards.noExpiry')
              }
              onPress={() => router.push(`/(customer)/card/${card.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, paddingRight: spacing.md },
  loader: { marginTop: spacing.xxl },
  list: { gap: spacing.sm },
});
