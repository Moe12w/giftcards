// src/components/DiscoveryCards.tsx
// Presentational cards used by the Explore homepage: category shortcuts,
// editorial collections, featured businesses, trending gift cards and
// personalised recommendations. All share the sticker-style visual language.
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, Plus, Star } from 'lucide-react-native';

import { offerStartingPriceMinor, offerTitle, offerTone } from '../lib/catalog';
import { glyphIcon } from '../lib/glyphs';
import type { AccentTone, Offer } from '../lib/types';
import { colors, edges, fonts, fontSizes, radii, spacing } from '../theme';
import { Card, type CardTone } from './Card';
import { IconTile, type IconTileTone } from './IconTile';
import { Money } from './Money';

const BACKGROUNDS: Record<AccentTone, string> = {
  teal: colors.tealTint,
  pink: colors.pinkTint,
  lavender: colors.lavenderTint,
  gold: colors.creamSoft,
  sky: colors.skySoft,
};

const EDGES: Record<AccentTone, string> = {
  teal: edges.teal,
  pink: edges.pink,
  lavender: edges.lavender,
  gold: edges.gold,
  sky: edges.ink,
};

const CARD_TONES: Record<AccentTone, CardTone> = {
  teal: 'teal',
  pink: 'pink',
  lavender: 'lavender',
  gold: 'gold',
  sky: 'sky',
};

function vendorBanner(offer: Offer): string {
  return (
    offer.vendor?.banner_url ??
    `https://placehold.co/900x300/png?text=${encodeURIComponent(offer.vendor?.name ?? offer.title)}`
  );
}

interface CategoryShortcutProps {
  label: string;
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  icon: string;
  tone: AccentTone;
  onPress: () => void;
}

export function CategoryShortcut({ label, icon, tone, onPress }: CategoryShortcutProps) {
  const Icon = glyphIcon(icon);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.edge,
        styles.categoryEdge,
        { backgroundColor: EDGES[tone] },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.categoryTile, { backgroundColor: BACKGROUNDS[tone] }]}>
        <View style={styles.categoryIcon}>
          <Icon size={22} color={colors.ink} strokeWidth={2} />
        </View>
        <Text style={styles.categoryLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
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
  const Icon = glyphIcon(icon);
  const rtl = i18n.language === 'ar';
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.edge,
        styles.collectionEdge,
        { backgroundColor: EDGES[tone] },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.collectionTile, { backgroundColor: BACKGROUNDS[tone] }]}>
        <View style={styles.collectionTop}>
          <View style={styles.collectionIcon}>
            <Icon size={26} color={colors.ink} strokeWidth={2} />
          </View>
          <View style={styles.collectionArrow}>
            <Arrow size={15} color={colors.ink} />
          </View>
        </View>
        <Text style={styles.collectionTitle} numberOfLines={2}>
          {label}
        </Text>
        <Text style={styles.collectionSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

interface FeaturedBusinessCardProps {
  offer: Offer;
  onPress: () => void;
}

export function FeaturedBusinessCard({ offer, onPress }: FeaturedBusinessCardProps) {
  const { t, i18n } = useTranslation();
  const tone = offerTone(offer) as AccentTone;
  const name = offer.vendor?.name ?? offerTitle(offer, i18n.language);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [styles.businessEdge, { backgroundColor: EDGES[tone] }, pressed && styles.pressed]}
    >
      <View style={styles.businessCard}>
        <Image source={{ uri: vendorBanner(offer) }} style={styles.businessBanner} resizeMode="cover" />
        <View style={styles.businessBody}>
          <View style={styles.businessLogo}>
            <IconTile
              icon={offer.icon}
              imageUrl={offer.vendor?.logo_url}
              size={48}
              tone={tone as IconTileTone}
            />
          </View>
          <Text style={styles.businessName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.businessMeta}>
            <Star size={12} color={colors.gold} />
            <Text style={styles.businessMetaText}>{(offer.rating ?? 4.8).toFixed(1)}</Text>
            {offer.location ? (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.businessMetaText} numberOfLines={1}>
                  {offer.location}
                </Text>
              </>
            ) : null}
          </View>
          <View style={styles.businessFooter}>
            <Text style={styles.businessFrom}>{t('common.from')}</Text>
            <Money minor={offerStartingPriceMinor(offer)} style={styles.businessAmount} />
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

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.trendingWrap, pressed && styles.pressed]}
    >
      <Card tone={CARD_TONES[tone]} style={styles.trendingCard}>
        <View style={styles.trendingTop}>
          <IconTile
            icon={offer.icon}
            imageUrl={offer.vendor?.logo_url}
            size={46}
            tone={tone as IconTileTone}
          />
          <View style={styles.ratingPill}>
            <Star size={11} color={colors.gold} />
            <Text style={styles.ratingText}>{(offer.rating ?? 4.8).toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.trendingTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.trendingVendor} numberOfLines={1}>
          {offer.vendor?.name ?? title}
        </Text>
        <View style={styles.trendingFooter}>
          <View style={styles.trendingPrice}>
            <Text style={styles.trendingFrom}>{t('common.from')}</Text>
            <Money minor={offerStartingPriceMinor(offer)} style={styles.trendingAmount} />
          </View>
          {onAdd ? (
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
          ) : null}
        </View>
      </Card>
    </Pressable>
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
            imageUrl={offer.vendor?.logo_url}
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

const styles = StyleSheet.create({
  edge: {
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingBottom: 4,
  },
  pressed: { opacity: 0.88, transform: [{ translateY: 2 }] },
  categoryEdge: { width: 100 },
  categoryTile: {
    minHeight: 104,
    borderRadius: radii.md - 2,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.ink,
    textAlign: 'center',
  },
  collectionEdge: { width: 232 },
  collectionTile: {
    minHeight: 154,
    borderRadius: radii.md - 2,
    padding: spacing.md,
    gap: spacing.xs,
  },
  collectionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collectionIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionArrow: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionTitle: {
    marginTop: spacing.xs,
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.lg,
    color: colors.ink,
  },
  collectionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  businessEdge: {
    width: 264,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.ink,
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
  trendingWrap: { width: 206 },
  trendingCard: { gap: 2 },
  trendingTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ratingText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.ink,
  },
  trendingTitle: {
    marginTop: spacing.xs,
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  trendingVendor: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  trendingFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.xs,
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
    borderColor: colors.ink,
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
    borderColor: colors.ink,
    backgroundColor: colors.tealTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { color: colors.textMuted, fontSize: fontSizes.xs },
});
