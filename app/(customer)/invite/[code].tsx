import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Gift, Link2, UserPlus, Users } from 'lucide-react-native';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { GiftBox3D } from '@/src/components/GiftBox3D';
import { IconTile, type IconTileTone } from '@/src/components/IconTile';
import { Money } from '@/src/components/Money';
import { ParticipantStack } from '@/src/components/ParticipantStack';
import { Screen } from '@/src/components/Screen';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { basketTotal, useBaskets } from '@/src/lib/baskets';
import type { AccentTone } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '@/src/theme';

/**
 * Invite landing page. A shared link (giftly://invite/CODE or /invite/CODE)
 * opens straight into the basket so a visitor can see the recipient, the cards
 * already inside and who is contributing, then join in one tap.
 */
export default function InviteScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { user } = useAuth();
  const { ready, getBasketByCode, joinBasket } = useBaskets();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(false);

  const basket = useMemo(
    () => (code ? getBasketByCode(code) : null),
    [code, getBasketByCode],
  );

  const alreadyJoined = Boolean(
    basket && user && basket.participants.some((participant) => participant.id === user.id),
  );

  useEffect(() => {
    if (ready && code && !basket) setError(true);
  }, [basket, code, ready]);

  async function join() {
    if (!basket) return;
    setJoining(true);
    const joined = await joinBasket(basket.code);
    setJoining(false);
    if (joined) {
      router.replace(`/(customer)/basket/${joined.id}?invite=1`);
    } else {
      setError(true);
    }
  }

  if (!ready) {
    return (
      <Screen>
        <FlowHeader title={t('basket.inviteTitle')} onBack={() => router.back()} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!basket || error) {
    return (
      <Screen>
        <FlowHeader title={t('basket.inviteTitle')} onBack={() => router.back()} />
        <EmptyState
          title={t('basket.inviteMissingTitle')}
          body={t('basket.inviteMissingBody')}
          icon="gift"
          tone="lavender"
        />
        <Button label={t('basket.joinTitle')} onPress={() => router.replace('/(customer)/basket/join')} />
        <Button
          label={t('basket.backToBaskets')}
          variant="secondary"
          onPress={() => router.replace('/(customer)/(tabs)/baskets')}
        />
      </Screen>
    );
  }

  const total = basketTotal(basket);
  const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en';

  return (
    <Screen>
      <FlowHeader
        title={t('basket.inviteTitle')}
        subtitle={t('basket.inviteSubtitle', { name: basket.creator_name })}
        onBack={() => router.back()}
      />

      <Card tone="lavender" style={styles.hero}>
        <View style={styles.heroTop}>
          <Badge label={t('basket.invited')} tone="primary" />
          <View style={styles.codePill}>
            <Link2 size={12} color={colors.ink} />
            <Text style={styles.codeText}>{basket.code}</Text>
          </View>
        </View>

        <GiftBox3D basket={basket} size={180} showMeta={false} idle />

        <Text style={styles.name} numberOfLines={2}>
          {basket.name}
        </Text>
        <Text style={styles.recipient} numberOfLines={1}>
          {t('basket.forRecipient', { name: basket.recipient_name })}
        </Text>

        <View style={styles.metaRow}>
          <Users size={13} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {t('basket.peopleCount', { count: basket.participants.length })}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.metaText}>
            {t('basket.cardsCount', { count: basket.items.length })}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <View style={styles.totalCopy}>
            <Text style={styles.totalLabel}>{t('basket.totalValue')}</Text>
            <Money minor={total} style={styles.totalAmount} />
          </View>
          <ParticipantStack participants={basket.participants} size={30} />
        </View>
      </Card>

      {alreadyJoined ? (
        <Card tone="teal" style={styles.joinedCard}>
          <CheckCircle2 size={18} color={colors.ink} />
          <Text style={styles.joinedText}>{t('basket.alreadyJoined')}</Text>
        </Card>
      ) : (
        <Button label={t('basket.joinThisBasket')} onPress={join} loading={joining} />
      )}

      <Button
        label={alreadyJoined ? t('basket.openBasket') : t('basket.inviteViewOnly')}
        variant="secondary"
        onPress={() => router.replace(`/(customer)/basket/${basket.id}`)}
      />

      <Card style={styles.list}>
        <Text style={styles.sectionTitle}>{t('basket.inside')}</Text>
        {basket.items.length === 0 ? (
          <Text style={styles.emptyText}>{t('basket.noItemsBody')}</Text>
        ) : (
          basket.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <IconTile
                icon={item.icon}
                imageUrl={item.logo_url}
                size={40}
                tone={(item.tone ?? 'lavender') as AccentTone as IconTileTone}
              />
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.vendor_name}
                </Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {t('basket.addedBy', { name: item.added_by_name })}
                </Text>
              </View>
              <Money minor={item.amount_minor} style={styles.itemAmount} />
            </View>
          ))
        )}
      </Card>

      <Card tone="pink" style={styles.tip}>
        <UserPlus size={18} color={colors.ink} />
        <Text style={styles.tipText}>{t('basket.inviteTip')}</Text>
      </Card>

      <Pressable
        onPress={() => router.replace('/(customer)/basket/join')}
        accessibilityRole="button"
        style={styles.altLink}
      >
        <Gift size={14} color={colors.textMuted} />
        <Text style={styles.altText}>{t('basket.haveAnotherCode')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  loader: { marginTop: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.xs },
  heroTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  codeText: { fontFamily: fonts.bold, fontSize: fontSizes.xs, color: colors.ink },
  name: {
    marginTop: spacing.xs,
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xl,
    color: colors.text,
    textAlign: 'center',
  },
  recipient: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  dot: { color: colors.textMuted, fontSize: fontSizes.xs },
  totalRow: {
    width: '100%',
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
  },
  totalCopy: { gap: 0 },
  totalLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  totalAmount: { fontSize: fontSizes.xl, color: colors.text },
  joinedCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  joinedText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  list: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: fontSizes.lg, color: colors.text },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemCopy: { flex: 1, gap: 1 },
  itemTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  itemMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  itemAmount: { fontSize: fontSizes.sm, color: colors.text },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text, lineHeight: 18 },
  altLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.xs,
  },
  altText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
}));
