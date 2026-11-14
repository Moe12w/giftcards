// src/components/OfferCard.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  offerBusinessId,
  offerBusinessLogo,
  offerBusinessName,
  offerIcon,
  offerStartingPriceMinor,
  offerTitle,
  offerTone,
} from '../lib/catalog';
import type { AccentTone, Offer } from '../lib/types';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Card, type CardTone } from './Card';
import { IconTile, type IconTileTone } from './IconTile';
import { Money } from './Money';

interface OfferCardProps {
  offer: Offer;
  index?: number;
  onPress: () => void;
  /**
   * Whether the vendor name opens the business page. Turn it off on the
   * business page itself, where the link would only reopen the same screen.
   */
  vendorLink?: boolean;
}

export function OfferCard({ offer, index = 0, onPress, vendorLink = true }: OfferCardProps) {
  const { t, i18n } = useTranslation();
  const title = offerTitle(offer, i18n.language);
  const tone = offerTone(offer, index) as AccentTone;
  const rtl = i18n.language === 'ar';
  const businessId = offerBusinessId(offer);
  const businessName = offerBusinessName(offer, title);
  const businessLogo = offerBusinessLogo(offer);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card>
        <View style={styles.row}>
          <IconTile
            icon={offerIcon(offer, index)}
            imageUrl={businessLogo}
            size={64}
            tone={tone as IconTileTone}
          />
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {vendorLink && businessId ? (
              <Pressable
                onPress={() => router.push(`/(customer)/business/${businessId}`)}
                accessibilityRole="button"
                accessibilityLabel={businessName}
                hitSlop={6}
              >
                <Text style={styles.vendor} numberOfLines={1}>
                  {t('home.fromVendor', { vendor: businessName })}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.vendor} numberOfLines={1}>
                {t('home.fromVendor', { vendor: businessName })}
              </Text>
            )}
            <View style={styles.meta}>
              <Star size={12} color={colors.gold} />
              <Text style={styles.metaText}>{(offer.rating ?? 4.8).toFixed(1)}</Text>
              {offer.location ? (
                <>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.metaText}>{offer.location}</Text>
                </>
              ) : null}
            </View>
          </View>
          <View style={styles.right}>
            <Text style={styles.from}>{t('common.from')}</Text>
            <Money minor={offerStartingPriceMinor(offer)} style={styles.amount} />
            <View style={styles.chevron}>
              {rtl ? (
                <ArrowLeft size={16} color={colors.ink} />
              ) : (
                <ArrowRight size={16} color={colors.ink} />
              )}
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export function OfferTile({ offer, index = 0, onPress }: OfferCardProps) {
  const { t, i18n } = useTranslation();
  const title = offerTitle(offer, i18n.language);
  const tone = offerTone(offer, index) as AccentTone;
  const businessName = offerBusinessName(offer, title);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}
    >
      <Card tone={tone as CardTone} style={styles.tileCard}>
        <IconTile
          icon={offerIcon(offer, index)}
          imageUrl={offerBusinessLogo(offer)}
          size={52}
          tone={tone as IconTileTone}
        />
        <Text style={styles.tileTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.tileVendor} numberOfLines={1}>
          {businessName}
        </Text>
        <View style={styles.tileAmountRow}>
          <Text style={styles.from}>{t('common.from')}</Text>
          <Money minor={offerStartingPriceMinor(offer)} style={styles.tileAmount} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: 2 },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  vendor: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  dot: { color: colors.textMuted, fontSize: fontSizes.xs },
  right: { alignItems: 'flex-end', gap: 2 },
  from: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  amount: { fontSize: fontSizes.md, color: colors.text },
  chevron: {
    marginTop: 4,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tealTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileWrap: { width: 180 },
  tileCard: { gap: spacing.xs },
  tileTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    marginTop: spacing.xs,
  },
  tileVendor: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  tileAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: spacing.xs,
  },
  tileAmount: { fontSize: fontSizes.md, color: colors.text },
  pressed: { opacity: 0.9 },
}));
