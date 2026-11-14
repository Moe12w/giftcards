import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Glyph } from '@/src/components/Glyph';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { useCards } from '@/src/lib/cards';
import { useThemeRefresh } from '@/src/lib/theme';
import { formatMoney } from '@/src/lib/money';
import { timeAgo } from '@/src/lib/time';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function GiftTransactionsScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { entries, getCard } = useCards();

  const rows = useMemo(
    () =>
      [...entries]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((entry) => ({ entry, card: getCard(entry.card_id) }))
        .filter((row) => Boolean(row.card)),
    [entries, getCard],
  );

  return (
    <Screen>
      <FlowHeader
        title={t('gifts.transactionsTitle')}
        subtitle={t('gifts.transactionsSubtitle')}
        onBack={() => router.back()}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={t('gifts.noTransactionsTitle')}
          body={t('gifts.noTransactionsBody')}
          icon="receipt"
          tone="lavender"
        />
      ) : (
        <View style={styles.list}>
          {rows.map(({ entry, card }) => (
            <Card key={entry.id} style={styles.row}>
              <View style={styles.icon}>
                <Glyph
                  name={entry.kind === 'session' ? 'ticket' : 'creditCard'}
                  size={18}
                  color={colors.ink}
                />
              </View>
              <View style={styles.copy}>
                <Text style={styles.title} numberOfLines={1}>
                  {card?.partner_name ?? card?.vendor_name ?? card?.offer_title ?? t('gifts.transactionsTitle')}
                </Text>
                <Text style={styles.meta}>
                  {entry.kind === 'session'
                    ? t('gifts.transactionSession', {
                        count: entry.sessions ?? 1,
                        name: card?.recipient_name ?? '',
                      })
                    : t('gifts.transactionValue', {
                        amount: formatMoney(entry.amount_minor ?? 0, i18n.language === 'ar' ? 'ar' : 'en'),
                        name: card?.recipient_name ?? '',
                      })}
                </Text>
                <Text style={styles.date}>
                  {timeAgo(entry.created_at, i18n.language === 'ar' ? 'ar' : 'en')}
                </Text>
              </View>
              {entry.kind === 'monetary' ? (
                <Money minor={entry.amount_minor ?? 0} style={styles.amount} />
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tealTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  date: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  amount: { fontSize: fontSizes.md, color: colors.text },
}));
