import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { BadgeTone } from '@/src/components/Badge';
import { EmptyState } from '@/src/components/EmptyState';
import { GiftCardVisual } from '@/src/components/GiftCardVisual';
import { Screen } from '@/src/components/Screen';
import { ShowMore, usePaged } from '@/src/components/ShowMore';
import { SkeletonList } from '@/src/components/Skeleton';
import { SplashText } from '@/src/components/SplashText';
import { useCards } from '@/src/lib/cards';
import { cardHref, prefetchCard } from '@/src/lib/navigation';
import { useThemeRefresh } from '@/src/lib/theme';
import { formatMoney } from '@/src/lib/money';
import type { CardStatus } from '@/src/lib/types';
import { CARD_STATUS_TONE } from '@/src/lib/status';
import { colors, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function CardsScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  // The wallet provider already loaded these rows for the app; re-querying
  // here would download the same vouchers a second time.
  const { ready, cards } = useCards();
  const loading = !ready;
  const page = usePaged(cards, 4);

  return (
    <Screen>
      <View style={styles.header}>
        <SplashText fontSize={fontSizes.display}>{t('cards.title')}</SplashText>
        <Text style={styles.subtitle}>{t('cards.subtitle')}</Text>
      </View>

      {loading ? (
        <SkeletonList rows={3} />
      ) : cards.length === 0 ? (
        <EmptyState title={t('cards.noCards')} body={t('cards.noCardsBody')} icon="gift" />
      ) : (
        <View style={styles.list}>
          {page.visible.map((card) => (
            <GiftCardVisual
              key={card.id}
              title={card.partner_name ?? card.vendor_name ?? card.offer_title ?? 'Gift card'}
              icon={card.icon}
              logoUrl={card.image_url}
              tone={card.tone}
              amountMinor={card.balance_minor ?? card.original_value_minor}
              meta={`${t('cards.originalValue')}: ${formatMoney(card.original_value_minor, i18n.language === 'ar' ? 'ar' : 'en')}`}
              badge={{ label: t(`cards.${card.status}`), tone: CARD_STATUS_TONE[card.status] }}
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
          ))}
        </View>
      )}
      {page.hasMore ? <ShowMore expanded={page.expanded} onPress={page.toggle} /> : null}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  header: { gap: spacing.xs, marginTop: spacing.sm },
  subtitle: { fontSize: fontSizes.md, color: colors.textMuted },
  list: { gap: spacing.md },
}));
