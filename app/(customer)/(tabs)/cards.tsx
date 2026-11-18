import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { SkeletonList } from '@/src/components/Skeleton';
import { useCards } from '@/src/lib/cards';
import { cardHref, prefetchCard } from '@/src/lib/navigation';
import { useThemeRefresh } from '@/src/lib/theme';
import { formatMoney } from '@/src/lib/money';
import type { CardStatus } from '@/src/lib/types';
import { colors, fontSizes, spacing, themedStyles } from '@/src/theme';

const statusTone: Record<CardStatus, BadgeTone> = {
  issued: 'warning',
  claimed: 'success',
  redeemed: 'neutral',
  expired: 'danger',
  voided: 'danger',
};

export default function CardsScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  // The wallet provider already loaded these rows for the app; re-querying
  // here would download the same vouchers a second time.
  const { ready, cards } = useCards();
  const loading = !ready;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t('cards.title')}</Text>
        <Text style={styles.subtitle}>{t('cards.subtitle')}</Text>
      </View>

      {loading ? (
        <SkeletonList rows={3} />
      ) : cards.length === 0 ? (
        <EmptyState title={t('cards.noCards')} body={t('cards.noCardsBody')} icon="gift" />
      ) : (
        <View style={styles.list}>
          {cards.map((card) => (
            <Pressable
              key={card.id}
              onPressIn={() => prefetchCard(card.id)}
              onPress={() =>
                router.push(
                  cardHref({
                    id: card.id,
                    name: card.partner_name ?? card.vendor_name ?? card.offer_title,
                  }) as never,
                )
              }
              accessibilityRole="button"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.vendor}>{card.partner_name ?? card.vendor_name ?? card.offer_title ?? 'Gift card'}</Text>
                  <Badge label={t(`cards.${card.status}`)} tone={statusTone[card.status]} />
                </View>
                <Text style={styles.balanceLabel}>{t('cards.balance')}</Text>
                <Money minor={card.balance_minor ?? card.original_value_minor} style={styles.balance} />
                <View style={styles.cardBottom}>
                  <Text style={styles.original}>
                    {t('cards.originalValue')}: {formatMoney(card.original_value_minor, i18n.language === 'ar' ? 'ar' : 'en')}
                  </Text>
                  <Text style={styles.details}>{t('cards.details')} →</Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  header: { gap: spacing.xs, marginTop: spacing.sm },
  title: { fontSize: fontSizes.display, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: fontSizes.md, color: colors.textMuted },
  list: { gap: spacing.md },
  card: { gap: spacing.xs },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vendor: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text, flex: 1 },
  balanceLabel: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.sm },
  balance: { fontSize: fontSizes.display, fontWeight: '700', color: colors.primaryDark },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  original: { fontSize: fontSizes.xs, color: colors.textMuted },
  details: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: '600' },
  pressed: { opacity: 0.9 },
}));
