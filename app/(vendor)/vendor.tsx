import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Ticket, Wallet } from 'lucide-react-native';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { Glyph } from '@/src/components/Glyph';
import { IconTile } from '@/src/components/IconTile';
import { Money } from '@/src/components/Money';
import { PageHeader } from '@/src/components/PageHeader';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { SessionMeter } from '@/src/components/SessionMeter';
import { useCards } from '@/src/lib/cards';
import { isSessionCard } from '@/src/lib/sessions';
import { timeAgo } from '@/src/lib/time';
import type { GiftCard } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

interface VendorOption {
  id: string;
  name: string;
}

const VENDORS: VendorOption[] = [
  { id: 'vendor-2', name: 'Dune Spa' },
  { id: 'vendor-5', name: 'Peak Fitness' },
  { id: 'vendor-9', name: 'Azure Spa' },
  { id: 'vendor-10', name: 'Pearl Hotel' },
  { id: 'vendor-8', name: 'Desert Adventures' },
  { id: 'vendor-1', name: 'The Coffee House' },
  { id: 'vendor-3', name: 'Souq Kitchen' },
];

export default function VendorHome() {
  const { t, i18n } = useTranslation();
  const { ready, cardsForVendor, entriesFor, sessionsLeft, valueLeft, canRedeem, redeemSession, redeemValue } =
    useCards();
  const [vendorId, setVendorId] = useState(VENDORS[0].id);
  const [busy, setBusy] = useState<string | null>(null);

  const vendor = VENDORS.find((entry) => entry.id === vendorId) ?? VENDORS[0];
  const cards = useMemo(() => cardsForVendor(vendorId), [cardsForVendor, vendorId]);

  const sessionCards = useMemo(() => cards.filter((card) => isSessionCard(card)), [cards]);
  const valueCards = useMemo(() => cards.filter((card) => !isSessionCard(card)), [cards]);

  const stats = useMemo(() => {
    const sessionsToServe = sessionCards.reduce((sum, card) => sum + sessionsLeft(card), 0);
    const outstanding = valueCards.reduce((sum, card) => sum + valueLeft(card), 0);
    const expiring = cards.filter((card) => {
      if (!card.expires_at) return false;
      const days = (new Date(card.expires_at).getTime() - Date.now()) / 86_400_000;
      return days > 0 && days <= 30;
    }).length;
    return { sessionsToServe, outstanding, expiring };
  }, [cards, sessionCards, valueCards, sessionsLeft, valueLeft]);

  const recent = useMemo(
    () =>
      cards
        .flatMap((card) => entriesFor(card.id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 6),
    [cards, entriesFor],
  );

  function serveSession(card: GiftCard) {
    const left = sessionsLeft(card);
    setBusy(card.id);
    const entry = redeemSession(card.id, vendor.name, card.offer_title ?? undefined);
    setBusy(null);
    if (!entry) {
      Alert.alert(t('vendor.serveTitle'), t('vendor.noSessionsLeft'));
      return;
    }
    Alert.alert(
      t('vendor.serveTitle'),
      t('vendor.served', {
        name: card.recipient_name ?? '',
        left: Math.max(0, left - 1),
      }),
    );
  }

  function spendValue(card: GiftCard) {
    const left = valueLeft(card);
    const amount = Math.min(left, 10000);
    setBusy(card.id);
    const entry = redeemValue(card.id, amount, vendor.name);
    setBusy(null);
    if (!entry) {
      Alert.alert(t('vendor.redeemTitle'), t('vendor.noBalanceLeft'));
    }
  }

  if (!ready) {
    return (
      <Screen>
        <FlowHeader title={t('vendor.title')} onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlowHeader title={t('vendor.title')} subtitle={vendor.name} onBack={() => router.back()} />

      <PageHeader title={vendor.name} subtitle={t('vendor.dashboardSubtitle')} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.vendorScrollOuter}
        contentContainerStyle={styles.vendorScroll}
      >
        {VENDORS.map((entry) => (
          <Chip
            key={entry.id}
            label={entry.name}
            active={entry.id === vendorId}
            onPress={() => setVendorId(entry.id)}
          />
        ))}
      </ScrollView>

      <Card tone="lavender" style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.sessionsToServe}</Text>
          <Text style={styles.statLabel}>{t('vendor.sessionsToServe')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{sessionCards.length}</Text>
          <Text style={styles.statLabel}>{t('vendor.experienceCards')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.expiring}</Text>
          <Text style={styles.statLabel}>{t('vendor.expiringSoon')}</Text>
        </View>
      </Card>

      {stats.outstanding > 0 ? (
        <Card tone="teal" style={styles.outstanding}>
          <View style={styles.outstandingIcon}>
            <Wallet size={20} color={colors.ink} />
          </View>
          <View style={styles.outstandingCopy}>
            <Text style={styles.outstandingLabel}>{t('vendor.valueOutstanding')}</Text>
            <Money minor={stats.outstanding} style={styles.outstandingValue} />
          </View>
        </Card>
      ) : null}

      <SectionHeader title={t('vendor.experienceCards')} />
      {sessionCards.length === 0 ? (
        <EmptyState
          title={t('vendor.noCards')}
          body={t('vendor.noCardsBody')}
          icon="ticket"
          tone="lavender"
        />
      ) : (
        <View style={styles.list}>
          {sessionCards.map((card) => {
            const remaining = sessionsLeft(card);
            const total = card.sessions_total ?? 1;
            const expired = card.expires_at ? new Date(card.expires_at).getTime() < Date.now() : false;
            return (
              <Card key={card.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <IconTile icon={card.icon} size={48} tone={card.tone ?? 'teal'} />
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {card.recipient_name ?? t('vendor.holder')}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {card.offer_title ?? card.vendor_name}
                    </Text>
                  </View>
                  <Badge
                    label={t('sessions.leftOf', { remaining, total })}
                    tone={remaining === 0 ? 'neutral' : 'primary'}
                  />
                </View>

                <SessionMeter remaining={remaining} total={total} tone={card.tone ?? 'teal'} />

                {expired ? (
                  <Text style={styles.expired}>{t('vendor.expiredCard')}</Text>
                ) : null}

                <Button
                  label={
                    remaining === 0
                      ? t('vendor.allSessionsUsed')
                      : t('vendor.serveSession', { name: card.recipient_name ?? '' })
                  }
                  disabled={remaining === 0 || busy === card.id}
                  loading={busy === card.id}
                  onPress={() => serveSession(card)}
                />
              </Card>
            );
          })}
        </View>
      )}

      {valueCards.length > 0 ? (
        <>
          <SectionHeader title={t('vendor.valueCards')} />
          <View style={styles.list}>
            {valueCards.map((card) => (
              <Card key={card.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <IconTile icon={card.icon} size={44} tone={card.tone ?? 'gold'} />
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {card.recipient_name ?? t('vendor.holder')}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {card.offer_title ?? card.vendor_name}
                    </Text>
                  </View>
                  <Money minor={valueLeft(card)} style={styles.cardAmount} />
                </View>
                <Button
                  label={t('vendor.redeemValue')}
                  variant="secondary"
                  disabled={!canRedeem(card) || busy === card.id}
                  onPress={() => spendValue(card)}
                />
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {recent.length > 0 ? (
        <>
          <SectionHeader title={t('vendor.recentActivity')} />
          <Card style={styles.activityCard}>
            {recent.map((entry, index) => {
              const card = cards.find((candidate) => candidate.id === entry.card_id);
              return (
                <View key={entry.id} style={[styles.activityRow, index > 0 && styles.activityDivider]}>
                  <View style={styles.activityIcon}>
                    {entry.kind === 'session' ? (
                      <Ticket size={15} color={colors.ink} />
                    ) : (
                      <Check size={15} color={colors.ink} />
                    )}
                  </View>
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityTitle} numberOfLines={1}>
                      {card?.recipient_name ?? t('vendor.holder')} ·{' '}
                      {entry.kind === 'session'
                        ? t('vendor.sessionUsed')
                        : t('vendor.valueRedeemed', { amount: entry.amount_minor ?? 0 })}
                    </Text>
                    <Text style={styles.activityMeta}>
                      {entry.actor} · {timeAgo(entry.created_at, i18n.language === 'ar' ? 'ar' : 'en')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      <View style={styles.footer}>
        <Glyph name="shield" size={14} />
        <Text style={styles.footerText}>{t('vendor.footerNote')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  vendorScrollOuter: { marginHorizontal: -spacing.gutter },
  vendorScroll: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  statDivider: { width: 1, height: 30, backgroundColor: colors.borderSoft },
  outstanding: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  outstandingIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outstandingCopy: { flex: 1, gap: 1 },
  outstandingLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  outstandingValue: { fontSize: fontSizes.lg, color: colors.text },
  list: { gap: spacing.sm },
  card: { gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardCopy: { flex: 1, gap: 1 },
  cardTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  cardSub: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  cardAmount: { fontSize: fontSizes.md, color: colors.text },
  expired: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.danger ?? colors.textMuted },
  activityCard: { gap: 0 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  activityDivider: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  activityIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCopy: { flex: 1, gap: 1 },
  activityTitle: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  activityMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center' },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    flexShrink: 1,
  },
});
