// src/components/DiscoveryCards.tsx
// Presentational cards used by the Explore homepage: category shortcuts,
// editorial collections, featured businesses, trending gift cards and
// personalised recommendations. All share the sticker-style visual language.
import React from 'react';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, Plus, Star } from 'lucide-react-native';

import {
  offerBusinessName,
  offerImage,
  offerStartingPriceMinor,
  offerTitle,
  offerTone,
} from '../lib/catalog';
import type { AccentTone, MarketplaceBusiness, Offer } from '../lib/types';
import { colors, edges, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Card } from './Card';
import { IconTile, type IconTileTone } from './IconTile';
import { Money } from './Money';
import { PosterCard } from './PosterCard';

const EDGES: Record<AccentTone, string> = {
  get teal() { return edges.teal; },
  get pink() { return edges.pink; },
  get lavender() { return edges.lavender; },
  get gold() { return edges.gold; },
  get sky() { return edges.ink; },
};

const FEATURED_TONES: AccentTone[] = ['gold', 'teal', 'pink', 'lavender', 'sky'];

interface CategoryShortcutProps {
  label: string;
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  icon: string;
  tone: AccentTone;
  onPress: () => void;
}

export function CategoryShortcut({ label, icon, tone, onPress }: CategoryShortcutProps) {
  return (
    <PosterCard
      tone={tone}
      icon={icon}
      iconSize={30}
      title={label}
      titleNumberOfLines={2}
      width={168}
      artHeight={86}
      onPress={onPress}
      accessibilityLabel={label}
    />
  );
}

interface CuratedCollectionCardProps {
  label: string;
  subtitle: string;
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  icon: string;
  tone: AccentTone;
  onPress: () => void;
}

export function CuratedCollectionCard({
  label,
  subtitle,
  icon,
  tone,
  onPress,
}: CuratedCollectionCardProps) {
  const { i18n } = useTranslation();
  const rtl = i18n.language === 'ar';
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <PosterCard
      tone={tone}
      icon={icon}
      iconSize={30}
      title={label}
      subtitle={subtitle}
      width={232}
      artHeight={96}
      artRight={
        <View style={styles.arrow}>
          <Arrow size={15} color={colors.ink} />
        </View>
      }
      onPress={onPress}
      accessibilityLabel={label}
    />
  );
}

interface FeaturedBusinessCardProps {
  business: MarketplaceBusiness;
  index?: number;
  onPress: () => void;
  onPressIn?: () => void;
}

export function FeaturedBusinessCard({
  business,
  index = 0,
  onPress,
  onPressIn,
}: FeaturedBusinessCardProps) {
  const { t } = useTranslation();
  const tone = FEATURED_TONES[index % FEATURED_TONES.length];
  const location = business.area ?? business.city;
  const banner =
    business.banner_url ??
    `https://placehold.co/900x300/png?text=${encodeURIComponent(business.name)}`;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      accessibilityRole="button"
      accessibilityLabel={business.name}
      style={({ pressed }) => [styles.businessEdge, { backgroundColor: EDGES[tone] }, pressed && styles.pressed]}
    >
      <View style={styles.businessCard}>
        <Image
          source={banner}
          style={styles.businessBanner}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={160}
        />
        <View style={styles.businessBody}>
          <View style={styles.businessLogo}>
            <IconTile
              icon="store"
              imageUrl={business.logo_url}
              size={48}
              tone={tone as IconTileTone}
            />
          </View>
          <Text style={styles.businessName} numberOfLines={1}>
            {business.name}
          </Text>
          <View style={styles.businessMeta}>
            <Star size={12} color={colors.gold} />
            <Text style={styles.businessMetaText}>{(business.rating ?? 4.8).toFixed(1)}</Text>
            {location ? (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.businessMetaText} numberOfLines={1}>
                  {location}
                </Text>
              </>
            ) : null}
          </View>
          <View style={styles.businessFooter}>
            <Text style={styles.businessFrom}>
              {business.gift_count === 1
                ? t('business.oneGift')
                : t('business.manyGifts', { count: business.gift_count })}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

interface TrendingGiftCardProps {
  offer: Offer;
  onPress: () => void;
  onAdd?: () => void;
  added?: boolean;
  addLabel?: string;
}

export function TrendingGiftCard({
  offer,
  onPress,
  onAdd,
  added = false,
  addLabel,
}: TrendingGiftCardProps) {
  const { t, i18n } = useTranslation();
  const tone = offerTone(offer) as AccentTone;
  const title = offerTitle(offer, i18n.language);
  const image = offerImage(offer);

  return (
    <PosterCard
      tone={tone}
      icon={offer.icon}
      iconNode={image ? (
        <View style={styles.artLogo}>
          <Image source={image} style={styles.artLogoImage} contentFit="contain" cachePolicy="memory-disk" />
        </View>
      ) : undefined}
      title={title}
      subtitle={offerBusinessName(offer, title)}
      width={206}
      artHeight={106}
      artRight={
        <View style={styles.ratingPill}>
          <Star size={11} color={colors.gold} />
          <Text style={styles.ratingText}>{(offer.rating ?? 4.8).toFixed(1)}</Text>
        </View>
      }
      metaLeft={
        <View style={styles.trendingPrice}>
          <Text style={styles.trendingFrom}>{t('common.from')}</Text>
          <Money minor={offerStartingPriceMinor(offer)} style={styles.trendingAmount} />
        </View>
      }
      metaRight={
        onAdd ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onAdd();
            }}
            accessibilityRole="button"
            accessibilityLabel={addLabel ?? t('discovery.quickAdd')}
            hitSlop={6}
            style={({ pressed }) => [styles.addButton, added && styles.addButtonDone, pressed && styles.pressed]}
          >
            {added ? <Check size={16} color={colors.ink} /> : <Plus size={16} color={colors.ink} />}
          </Pressable>
        ) : undefined
      }
      onPress={onPress}
      accessibilityLabel={title}
    />
  );
}

interface RecommendationRowProps {
  offer: Offer;
  reason: string;
  onPress: () => void;
}

export function RecommendationRow({ offer, reason, onPress }: RecommendationRowProps) {
  const { t, i18n } = useTranslation();
  const tone = offerTone(offer) as AccentTone;
  const title = offerTitle(offer, i18n.language);
  const rtl = i18n.language === 'ar';
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card>
        <View style={styles.recommendRow}>
          <IconTile
            icon={offer.icon}
            imageUrl={offerImage(offer)}
            size={54}
            tone={tone as IconTileTone}
          />
          <View style={styles.recommendBody}>
            <Text style={styles.reason}>{reason}</Text>
            <Text style={styles.recommendTitle} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.recommendMeta}>
              <Star size={11} color={colors.gold} />
              <Text style={styles.recommendMetaText}>{(offer.rating ?? 4.8).toFixed(1)}</Text>
              {offer.location ? (
                <>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.recommendMetaText}>{offer.location}</Text>
                </>
              ) : null}
            </View>
          </View>
          <View style={styles.recommendRight}>
            <Text style={styles.recommendFrom}>{t('common.from')}</Text>
            <Money minor={offerStartingPriceMinor(offer)} style={styles.recommendAmount} />
            <View style={styles.chevron}>
              <Arrow size={14} color={colors.ink} />
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  pressed: { opacity: 0.88, transform: [{ translateY: 2 }] },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artLogo: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artLogoImage: { width: 36, height: 36 },
  businessEdge: {
    width: 264,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    paddingBottom: 5,
  },
  businessCard: {
    borderRadius: radii.lg - 2,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  businessBanner: { width: '100%', height: 96 },
  businessBody: { padding: spacing.sm + 2, paddingTop: 0, gap: 2 },
  businessLogo: { marginTop: -24, marginBottom: spacing.xs },
  businessName: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  businessMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  businessMetaText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  businessFooter: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  businessFrom: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  businessAmount: { fontSize: fontSizes.md, color: colors.text },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ratingText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.ink,
  },
  trendingPrice: { gap: 0 },
  trendingFrom: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  trendingAmount: { fontSize: fontSizes.md, color: colors.text },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDone: { backgroundColor: colors.teal },
  recommendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recommendBody: { flex: 1, gap: 1 },
  reason: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.tealDark,
  },
  recommendTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  recommendMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  recommendMetaText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  recommendRight: { alignItems: 'flex-end', gap: 2 },
  recommendFrom: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  recommendAmount: { fontSize: fontSizes.md, color: colors.text },
  chevron: {
    marginTop: 2,
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.tealTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { color: colors.textMuted, fontSize: fontSizes.xs },
}));
