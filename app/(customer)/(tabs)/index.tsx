import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Bell, Gift, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/src/components/Avatar';
import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { SearchBar } from '@/src/components/SearchBar';
import { SectionHeader } from '@/src/components/SectionHeader';
import {
  CategoryShortcut,
  CuratedCollectionCard,
  FeaturedBusinessCard,
  RecommendationRow,
  TrendingGiftCard,
} from '@/src/components/DiscoveryCards';
import { CATEGORIES, CURATED_COLLECTIONS, groupOffersByVendor, offersForCollection } from '@/src/lib/catalog';
import { listActiveOffers } from '@/src/lib/data';
import { basketTotal, useBaskets } from '@/src/lib/baskets';
import { MOCK_NOTIFICATIONS } from '@/src/lib/mock-data';
import { useAuth } from '@/src/lib/auth';
import type { Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

export default function ExploreHomeScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { activeBasket } = useBaskets();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setError(false);
    listActiveOffers()
      .then((data) => active && setOffers(data))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const name = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0];
  const unread = useMemo(() => MOCK_NOTIFICATIONS.filter((n) => !n.read).length, []);

  const businesses = useMemo(() => groupOffersByVendor(offers).slice(0, 6), [offers]);
  const trending = useMemo(() => offersForCollection(offers, 'trending').slice(0, 8), [offers]);
  const recommended = useMemo(
    () =>
      [...offers]
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .filter((offer) => !trending.slice(0, 4).some((item) => item.id === offer.id))
        .slice(0, 3),
    [offers, trending],
  );

  const basketOfferIds = useMemo(
    () => new Set(activeBasket?.items.map((item) => item.offer_id) ?? []),
    [activeBasket],
  );

  function quickAdd(offer: Offer) {
    if (!activeBasket) {
      router.push(`/(customer)/gift/${offer.id}`);
      return;
    }
    const amountMinor = offer.preset_amounts_minor[0] ?? offer.min_amount_minor;
    router.push({
      pathname: '/(customer)/basket/contribute',
      params: {
        basketId: activeBasket.id,
        items: JSON.stringify([{ offerId: offer.id, amountMinor }]),
      },
    });
  }

  function reasonFor(offer: Offer, index: number): string {
    if (offer.category === 'coffee' || offer.category === 'desserts') {
      return t('discovery.reasonTreat');
    }
    if ((offer.rating ?? 0) >= 4.8) return t('discovery.reasonLoved');
    if (offer.location) return t('discovery.reasonNearby', { area: offer.location });
    return t('discovery.reasonNew', { index: index + 1 });
  }

  return (
    <View style={styles.root}>
      <Screen tabbed>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.greetingWrap}>
            <Text style={styles.greeting}>
              {name ? t('discovery.greeting', { name }) : t('discovery.greetingGeneric')}
            </Text>
            <Text style={styles.subtitle}>{t('discovery.subtitle')}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(customer)/notifications')}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.title')}
            style={styles.iconButton}
          >
            <Bell size={21} color={colors.ink} />
            {unread > 0 ? <View style={styles.unreadDot} /> : null}
          </Pressable>
          <Pressable
            onPress={() => router.push('/(customer)/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.title')}
          >
            <Avatar name={name ?? t('common.appName')} size={48} tone="pink" />
          </Pressable>
        </View>

        <SearchBar
          value=""
          onChangeText={() => undefined}
          onPress={() => router.push('/(customer)/search')}
          placeholder={t('discovery.searchPlaceholder')}
          accessibilityLabel={t('common.search')}
          style={styles.search}
        />

        {/* Active basket strip */}
        {activeBasket ? (
          <Pressable
            onPress={() => router.push(`/(customer)/basket/${activeBasket.id}`)}
            accessibilityRole="button"
            accessibilityLabel={activeBasket.name}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card tone="teal" style={styles.activeStrip}>
              <View style={styles.activeIcon}>
                <Gift size={22} color={colors.ink} />
              </View>
              <View style={styles.activeCopy}>
                <Text style={styles.activeLabel}>{t('discovery.fillingBasket')}</Text>
                <Text style={styles.activeTitle} numberOfLines={1}>
                  {activeBasket.name}
                </Text>
                <Text style={styles.activeMeta}>
                  {t('basket.cardsCount', { count: activeBasket.items.length })} ·{' '}
                  {t('basket.peopleCount', { count: activeBasket.participants.length })}
                </Text>
              </View>
              <Money minor={basketTotal(activeBasket)} style={styles.activeAmount} />
            </Card>
          </Pressable>
        ) : null}

        {/* Hero */}
        <Card tone="lavender" style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Badge label={t('discovery.heroBadge')} tone="primary" />
              <Text style={styles.heroTitle}>{t('discovery.heroTitle')}</Text>
              <Text style={styles.heroBody}>{t('discovery.heroBody')}</Text>
            </View>
            <View style={styles.heroArt}>
              <View style={styles.heroBlob} />
              <View style={styles.heroBoxBack} />
              <View style={styles.heroBoxFront}>
                <View style={styles.heroRibbonV} />
                <View style={styles.heroRibbonH} />
                <Gift size={26} color={colors.ink} />
              </View>
              <View style={styles.heroSparkle}>
                <Sparkles size={16} color={colors.ink} />
              </View>
            </View>
          </View>
          <View style={styles.heroActions}>
            <Button
              label={t('discovery.heroCta')}
              fullWidth={false}
              style={styles.heroButton}
              onPress={() => router.push('/(customer)/collection/trending')}
            />
            <Button
              label={t('discovery.heroSecondary')}
              variant="secondary"
              fullWidth={false}
              style={styles.heroButton}
              onPress={() => router.push('/(customer)/basket/create')}
            />
          </View>
        </Card>

        {/* Categories */}
        <SectionHeader
          title={t('discovery.featuredCategories')}
          actionLabel={t('common.seeAll')}
          onAction={() => router.push('/(customer)/categories')}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hScrollOuter}
          contentContainerStyle={styles.hScroll}
        >
          {CATEGORIES.map((category) => (
            <CategoryShortcut
              key={category.slug}
              label={t(category.titleKey)}
              emoji={category.emoji}
              tone={category.tone}
              onPress={() => router.push(`/(customer)/category/${category.slug}`)}
            />
          ))}
        </ScrollView>

        {/* Collections */}
        <SectionHeader title={t('discovery.featuredCollections')} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hScrollOuter}
          contentContainerStyle={styles.hScroll}
        >
          {CURATED_COLLECTIONS.map((collection) => (
            <CuratedCollectionCard
              key={collection.slug}
              label={t(collection.titleKey)}
              subtitle={t(collection.subtitleKey)}
              emoji={collection.emoji}
              tone={collection.tone}
              onPress={() => router.push(`/(customer)/collection/${collection.slug}`)}
            />
          ))}
        </ScrollView>

        {/* Featured businesses */}
        <SectionHeader
          title={t('discovery.featuredBusinesses')}
          actionLabel={t('common.seeAll')}
          onAction={() => router.push('/(customer)/collection/featured-businesses')}
        />
        {loading ? (
          <ActivityIndicator color={colors.teal} style={styles.loader} />
        ) : error ? (
          <Card tone="pink" style={styles.errorCard}>
            <EmptyState
              title={t('states.error.title')}
              body={t('states.error.body')}
              icon="⚠️"
              tone="pink"
            />
            <Button label={t('common.retry')} onPress={() => router.replace('/(customer)/(tabs)')} />
          </Card>
        ) : businesses.length === 0 ? (
          <EmptyState
            title={t('home.noOffers')}
            body={t('home.noOffersBody')}
            icon="🎁"
            tone="lavender"
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hScrollOuter}
            contentContainerStyle={styles.hScroll}
          >
            {businesses.map((offer) => (
              <FeaturedBusinessCard
                key={offer.vendor_id}
                offer={offer}
                onPress={() => router.push(`/(customer)/business/${offer.vendor_id}`)}
              />
            ))}
          </ScrollView>
        )}

        {/* Trending */}
        <SectionHeader
          title={t('discovery.trending')}
          actionLabel={t('common.seeAll')}
          onAction={() => router.push('/(customer)/collection/trending')}
        />
        {loading ? (
          <ActivityIndicator color={colors.teal} style={styles.loader} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hScrollOuter}
            contentContainerStyle={styles.hScroll}
          >
            {trending.map((offer) => (
              <TrendingGiftCard
                key={offer.id}
                offer={offer}
                added={basketOfferIds.has(offer.id)}
                onPress={() => router.push(`/(customer)/gift/${offer.id}`)}
                onAdd={() =>
                  basketOfferIds.has(offer.id) && activeBasket
                    ? router.push(`/(customer)/basket/${activeBasket.id}`)
                    : quickAdd(offer)
                }
                addLabel={t('discovery.quickAdd')}
              />
            ))}
          </ScrollView>
        )}

        {/* Recommended */}
        <SectionHeader
          title={t('discovery.recommended')}
          actionLabel={t('common.seeAll')}
          onAction={() => router.push('/(customer)/collection/popular')}
        />
        <View style={styles.list}>
          {recommended.map((offer, index) => (
            <RecommendationRow
              key={offer.id}
              offer={offer}
              reason={reasonFor(offer, index)}
              onPress={() => router.push(`/(customer)/gift/${offer.id}`)}
            />
          ))}
        </View>

        <Text style={styles.footnote}>{t('discovery.footnote', { language: i18n.language })}</Text>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  greetingWrap: { flex: 1, gap: 2 },
  greeting: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.pink,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  search: { marginTop: spacing.xs },
  activeStrip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2 },
  activeIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCopy: { flex: 1, gap: 0 },
  activeLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  activeTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  activeMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  activeAmount: { fontSize: fontSizes.md, color: colors.text },
  hero: { gap: spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroCopy: { flex: 1, gap: spacing.xs },
  heroTitle: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    letterSpacing: -0.5,
  },
  heroBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 19,
  },
  heroArt: { width: 108, height: 112, alignItems: 'center', justifyContent: 'center' },
  heroBlob: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.ink,
    opacity: 0.9,
  },
  heroBoxBack: {
    position: 'absolute',
    width: 62,
    height: 54,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.pink,
    transform: [{ rotate: '-10deg' }, { translateX: -8 }, { translateY: 4 }],
  },
  heroBoxFront: {
    width: 68,
    height: 60,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '5deg' }],
    overflow: 'hidden',
  },
  heroRibbonV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 12,
    backgroundColor: colors.gold,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.ink,
  },
  heroRibbonH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
    height: 12,
    backgroundColor: colors.gold,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.ink,
  },
  heroSparkle: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  heroButton: { flex: 1 },
  // The rows break out of the page gutter so cards can scroll to the screen
  // edges. The gutter is re-applied inside the content container so the first
  // and last card still line up with the page margin.
  hScrollOuter: { marginHorizontal: -spacing.gutter },
  hScroll: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  loader: { marginVertical: spacing.lg },
  list: { gap: spacing.sm },
  errorCard: { gap: spacing.sm },
  footnote: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  pressed: { opacity: 0.9, transform: [{ translateY: 2 }] },
});
