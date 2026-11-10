import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Gift, Link2, Sparkles, Users } from 'lucide-react-native';

import { Badge } from '@/src/components/Badge';
import { BasketPreviewCard } from '@/src/components/BasketPreviewCard';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { GiftBox3D } from '@/src/components/GiftBox3D';
import { Money } from '@/src/components/Money';
import { PageHeader } from '@/src/components/PageHeader';
import { ParticipantStack } from '@/src/components/ParticipantStack';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { TextField } from '@/src/components/TextField';
import { basketProgress, basketTotal, useBaskets } from '@/src/lib/baskets';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

export default function GiftBasketHubScreen() {
  const { t, i18n } = useTranslation();
  const { baskets, ready, activeBasket, completedBaskets, joinBasket } = useBaskets();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const rtl = i18n.language === 'ar';
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  const otherActive = useMemo(
    () =>
      baskets.filter(
        (basket) => basket.status !== 'completed' && basket.id !== activeBasket?.id,
      ),
    [activeBasket?.id, baskets],
  );

  function onJoin() {
    const next = code.trim().toUpperCase();
    if (!/^GIFT-[A-Z0-9]{5}$/.test(next)) {
      setError(t('basket.joinInvalid'));
      return;
    }
    setError(null);
    setJoining(true);
    const joined = joinBasket(next);
    setTimeout(() => {
      setJoining(false);
      if (joined) {
        setCode('');
        router.push(`/(customer)/basket/${joined.id}?invite=1`);
      } else {
        setError(t('basket.joinNotFound'));
      }
    }, 450);
  }

  if (!ready) {
    return (
      <Screen tabbed>
        <PageHeader title={t('basket.title')} subtitle={t('basket.subtitle')} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  const progress = activeBasket ? basketProgress(activeBasket) : 0;

  return (
    <Screen tabbed>
      <PageHeader title={t('basket.title')} subtitle={t('basket.subtitle')} />

      {/* Featured active basket */}
      {activeBasket ? (
        <Pressable
          onPress={() => router.push(`/(customer)/basket/${activeBasket.id}`)}
          accessibilityRole="button"
          accessibilityLabel={activeBasket.name}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card tone={activeBasket.status === 'ready' ? 'gold' : 'teal'} style={styles.featured}>
            <View style={styles.featuredTop}>
              <Badge
                label={t(`basket.status.${activeBasket.status}`)}
                tone={activeBasket.status === 'ready' ? 'warning' : 'success'}
              />
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{t('basket.live')}</Text>
              </View>
            </View>

            <View style={styles.featuredRow}>
              <GiftBox3D basket={activeBasket} size={148} showMeta={false} />
              <View style={styles.featuredCopy}>
                <Text style={styles.featuredLabel}>{t('basket.featuredLabel')}</Text>
                <Text style={styles.featuredTitle} numberOfLines={2}>
                  {activeBasket.name}
                </Text>
                <Text style={styles.featuredRecipient} numberOfLines={1}>
                  {t('basket.forRecipient', { name: activeBasket.recipient_name })}
                </Text>
                <View style={styles.featuredMeta}>
                  <Users size={12} color={colors.textMuted} />
                  <Text style={styles.featuredMetaText}>
                    {t('basket.peopleCount', { count: activeBasket.participants.length })}
                  </Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.featuredMetaText}>
                    {t('basket.cardsCount', { count: activeBasket.items.length })}
                  </Text>
                </View>
                <Money minor={basketTotal(activeBasket)} style={styles.featuredAmount} />
                {activeBasket.target_minor > 0 ? (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.featuredFooter}>
              <ParticipantStack participants={activeBasket.participants} size={28} />
              <View style={styles.openPill}>
                <Text style={styles.openPillText}>{t('basket.openBasket')}</Text>
                <Arrow size={14} color={colors.ink} />
              </View>
            </View>
          </Card>
        </Pressable>
      ) : (
        <Card tone="lavender" style={styles.emptyFeatured}>
          <View style={styles.emptyArt}>
            <Gift size={30} color={colors.ink} />
          </View>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>{t('basket.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('basket.emptyBody')}</Text>
          </View>
        </Card>
      )}

      {/* Create */}
      <Card tone="pink" style={styles.createCard}>
        <View style={styles.createRow}>
          <View style={styles.createIcon}>
            <Gift size={24} color={colors.ink} />
          </View>
          <View style={styles.createCopy}>
            <Text style={styles.createTitle}>{t('basket.createTitle')}</Text>
            <Text style={styles.createBody}>{t('basket.createBody')}</Text>
          </View>
        </View>
        <Button
          label={t('basket.createCta')}
          onPress={() => router.push('/(customer)/basket/create')}
        />
      </Card>

      {/* Join */}
      <Card style={styles.joinCard}>
        <View style={styles.joinHeader}>
          <View style={styles.joinIcon}>
            <Link2 size={20} color={colors.ink} />
          </View>
          <View style={styles.joinCopy}>
            <Text style={styles.joinTitle}>{t('basket.joinTitle')}</Text>
            <Text style={styles.joinBody}>{t('basket.joinBody')}</Text>
          </View>
        </View>
        <TextField
          label={t('basket.codeLabel')}
          value={code}
          onChangeText={(value) => {
            setCode(value.toUpperCase());
            setError(null);
          }}
          placeholder={t('basket.codePlaceholder')}
          autoCapitalize="characters"
          autoCorrect={false}
          error={error ?? undefined}
        />
        <Button label={t('basket.joinCta')} variant="secondary" onPress={onJoin} loading={joining} />
      </Card>

      {/* Active baskets */}
      <SectionHeader title={t('basket.activeBaskets')} />
      {otherActive.length === 0 ? (
        <Card style={styles.smallEmpty}>
          <Text style={styles.smallEmptyText}>{t('basket.noOtherActive')}</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {otherActive.map((basket) => (
            <BasketPreviewCard
              key={basket.id}
              basket={basket}
              onPress={() => router.push(`/(customer)/basket/${basket.id}`)}
            />
          ))}
        </View>
      )}

      {/* Completed */}
      <SectionHeader title={t('basket.completedBaskets')} />
      {completedBaskets.length === 0 ? (
        <Card style={styles.smallEmpty}>
          <Text style={styles.smallEmptyText}>{t('basket.noCompleted')}</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {completedBaskets.map((basket) => (
            <BasketPreviewCard
              key={basket.id}
              basket={basket}
              compact
              onPress={() => router.push(`/(customer)/basket/${basket.id}`)}
            />
          ))}
        </View>
      )}

      <Card tone="lavender" style={styles.tip}>
        <Sparkles size={18} color={colors.ink} />
        <Text style={styles.tipText}>{t('basket.tip')}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  pressed: { opacity: 0.92, transform: [{ translateY: 2 }] },
  featured: { gap: spacing.sm },
  featuredTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveText: { fontFamily: fonts.bold, fontSize: fontSizes.xs, color: colors.ink },
  featuredRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  featuredCopy: { flex: 1, gap: 1 },
  featuredLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  featuredTitle: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xl,
    color: colors.text,
    letterSpacing: -0.3,
  },
  featuredRecipient: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  featuredMetaText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  dot: { color: colors.textMuted, fontSize: fontSizes.xs },
  featuredAmount: { marginTop: spacing.xs, fontSize: fontSizes.xl, color: colors.text },
  progressTrack: {
    marginTop: spacing.xs,
    height: 9,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: { height: 5, backgroundColor: colors.teal },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
  },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  openPillText: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.ink },
  emptyFeatured: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emptyArt: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: { flex: 1, gap: 2 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  createCard: { gap: spacing.sm },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  createIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCopy: { flex: 1, gap: 2 },
  createTitle: { fontFamily: fonts.extrabold, fontSize: fontSizes.lg, color: colors.text },
  createBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  joinCard: { gap: spacing.sm },
  joinHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  joinIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.lavenderTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinCopy: { flex: 1, gap: 1 },
  joinTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  joinBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  list: { gap: spacing.sm },
  smallEmpty: { paddingVertical: spacing.md },
  smallEmptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 18,
  },
});
