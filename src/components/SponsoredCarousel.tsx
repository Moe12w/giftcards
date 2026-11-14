// src/components/SponsoredCarousel.tsx
// Sponsored placements are delivered by the backend. Nothing here hardcodes a
// campaign, a price or a schedule: the component asks for a placement key and
// renders whatever the delivery function returns. An empty response hides the
// whole section, so the customer app degrades cleanly when no campaign is live.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Megaphone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { listSponsoredAds, trackSponsoredClick } from '../lib/data';
import type { SponsoredAd, SponsoredPlacement } from '../lib/types';
import { colors, edges, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Card } from './Card';
import { SectionHeader } from './SectionHeader';

function labelFor(ad: SponsoredAd, language: string): string {
  const arabic = language === 'ar';
  return (
    (arabic ? ad.sponsored_label_ar : ad.sponsored_label) ||
    ad.sponsored_label ||
    (arabic ? 'إعلان مدفوع' : 'Sponsored')
  );
}

function headlineFor(ad: SponsoredAd, language: string): string {
  return (language === 'ar' ? ad.headline_ar : null) || ad.headline;
}

function bodyFor(ad: SponsoredAd, language: string): string | null {
  return (language === 'ar' ? ad.body_ar : null) || ad.body;
}

function ctaFor(ad: SponsoredAd, language: string, fallback: string): string {
  return (language === 'ar' ? ad.cta_label_ar : null) || ad.cta_label || fallback;
}

/** Parses the admin-set `aspect_ratio` config such as "2:1". */
function aspectRatioFrom(config: Record<string, unknown> | undefined): number {
  const raw = String(config?.aspect_ratio ?? '2:1');
  const [width, height] = raw.split(':').map((value) => Number(value.trim()));
  return width > 0 && height > 0 ? width / height : 2;
}

function autoRotateSeconds(config: Record<string, unknown> | undefined): number {
  const value = Number(config?.auto_rotate_seconds);
  if (!Number.isFinite(value) || value <= 0) return 15;
  return Math.min(30, Math.max(3, Math.round(value)));
}

/**
 * Sends the customer to the destination stored on the creative. The click is
 * recorded first (CPC charging and deduplication happen server-side) and the
 * canonical destination returned by the database wins over local state.
 */
async function openSponsoredAd(ad: SponsoredAd): Promise<void> {
  const canonical = await trackSponsoredClick(ad.impression_id).catch(() => null);
  const destinationType = canonical?.destination_type ?? ad.destination_type;
  const destinationId = canonical?.destination_id ?? ad.destination_id;
  const destinationUrl = canonical?.destination_url ?? ad.destination_url;

  if (destinationType === 'url') {
    const url = destinationUrl ?? '';
    if (/^https?:\/\//i.test(url)) {
      await Linking.openURL(url).catch(() => undefined);
    }
    return;
  }
  if (destinationType === 'business' && destinationId) {
    router.push(`/(customer)/business/${destinationId}` as never);
    return;
  }
  if (destinationType === 'gift_card' && destinationId) {
    router.push(`/(customer)/gift/${destinationId}` as never);
    return;
  }
  if (destinationType === 'category') {
    // Category routes use a static slug, while the ad stores the category id.
    // The categories tab is the safe canonical destination for this format.
    router.push('/(customer)/categories' as never);
    return;
  }
  if (destinationType === 'internal' && destinationUrl?.startsWith('/')) {
    router.push(destinationUrl as never);
  }
}

function SponsoredPill({ label }: { label: string }) {
  return (
    <View style={styles.sponsoredPill}>
      <Text style={styles.sponsoredPillText}>{label}</Text>
    </View>
  );
}

/** Full-width rotating banner used by the homepage hero carousel. */
export function SponsoredCarousel({
  placementKey,
  limit = 5,
  style,
}: {
  placementKey: string;
  limit?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t, i18n } = useTranslation();
  const window = useWindowDimensions();
  const [placement, setPlacement] = useState<SponsoredPlacement | null>(null);
  const [index, setIndex] = useState(0);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const width = measuredWidth || Math.max(0, window.width - spacing.gutter * 2);
  const ads = placement?.ads ?? [];
  const ratio = useMemo(() => aspectRatioFrom(placement?.config), [placement?.config]);
  const seconds = useMemo(() => autoRotateSeconds(placement?.config), [placement?.config]);

  useEffect(() => {
    let active = true;
    listSponsoredAds(placementKey, limit)
      .then((next) => {
        if (!active) return;
        setPlacement(next);
        setIndex(0);
        indexRef.current = 0;
      })
      .catch(() => active && setPlacement(null));
    return () => {
      active = false;
    };
  }, [placementKey, limit]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Auto-rotate uses the admin-set interval. Manual interaction pauses it for a
  // short while so a customer can read a slide without it moving underneath.
  useEffect(() => {
    if (ads.length < 2 || width <= 0) return;
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      const next = (indexRef.current + 1) % ads.length;
      indexRef.current = next;
      setIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [ads.length, width, seconds]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== measuredWidth) {
      setMeasuredWidth(next);
      // Keep the current slide aligned after an orientation change.
      if (indexRef.current > 0) {
        scrollRef.current?.scrollTo({ x: indexRef.current * next, animated: false });
      }
    }
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    const next = Math.max(0, Math.min(ads.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
    indexRef.current = next;
    setIndex(next);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      pausedRef.current = false;
    }, 10000);
  }

  function goTo(next: number) {
    indexRef.current = next;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    pausedRef.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      pausedRef.current = false;
    }, 10000);
  }

  if (ads.length === 0) {
    return (
      <View style={[styles.carousel, style]}>
        <Card padded={false} edgeColor={edges.ink}>
          <View style={[styles.imageFallback, { aspectRatio: 2 }]}>
            <Megaphone size={30} color={colors.ink} />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.carousel, style]}>
      <View onLayout={onLayout}>
        <Card padded={false} edgeColor={edges.ink}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={() => {
              pausedRef.current = true;
            }}
            onMomentumScrollEnd={onScrollEnd}
            onScrollEndDrag={onScrollEnd}
            scrollEventThrottle={16}
            accessibilityLabel={t('discovery.sponsoredTitle')}
          >
            {ads.map((ad) => {
              const image = ad.mobile_image_url || ad.image_url;
              const label = labelFor(ad, i18n.language);
              return (
                <Pressable
                  key={ad.impression_id}
                  onPress={() => void openSponsoredAd(ad)}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}: ${headlineFor(ad, i18n.language)}`}
                  style={({ pressed }) => [{ width }, pressed && styles.pressed]}
                >
                  <View style={styles.slide}>
                    <View style={styles.media}>
                      {image ? (
                        <Image
                          source={{ uri: image }}
                          style={[styles.image, { aspectRatio: ratio }]}
                          resizeMode="cover"
                          accessibilityIgnoresInvertColors
                        />
                      ) : (
                        <View style={[styles.imageFallback, { aspectRatio: ratio }]}>
                          <Megaphone size={30} color={colors.ink} />
                        </View>
                      )}
                      <View style={styles.pillPosition}>
                        <SponsoredPill label={label} />
                      </View>
                    </View>
                    <View style={styles.copy}>
                      <Text style={styles.headline} numberOfLines={2}>
                        {headlineFor(ad, i18n.language)}
                      </Text>
                      {bodyFor(ad, i18n.language) ? (
                        <Text style={styles.body} numberOfLines={2}>
                          {bodyFor(ad, i18n.language)}
                        </Text>
                      ) : null}
                      <View style={styles.ctaRow}>
                        <Text style={styles.cta}>{ctaFor(ad, i18n.language, t('discovery.learnMore'))}</Text>
                        <ArrowRight size={15} color={colors.ink} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>
      </View>

      {ads.length > 1 ? (
        <View style={styles.dots} accessibilityRole="tablist">
          {ads.map((ad, dotIndex) => (
            <Pressable
              key={ad.impression_id}
              onPress={() => goTo(dotIndex)}
              accessibilityRole="tab"
              accessibilityState={{ selected: dotIndex === index }}
              accessibilityLabel={headlineFor(ad, i18n.language)}
              hitSlop={8}
              style={[styles.dot, dotIndex === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Sponsored business or gift-card strip. Used for the homepage featured rows
 * and reusable on marketplace/search surfaces with a different placement key.
 */
export function SponsoredStrip({
  placementKey,
  variant,
  limit = 4,
  style,
}: {
  placementKey: string;
  variant: 'business' | 'gift_card';
  limit?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t, i18n } = useTranslation();
  const [placement, setPlacement] = useState<SponsoredPlacement | null>(null);

  useEffect(() => {
    let active = true;
    listSponsoredAds(placementKey, limit)
      .then((next) => active && setPlacement(next))
      .catch(() => active && setPlacement(null));
    return () => {
      active = false;
    };
  }, [placementKey, limit]);

  const ads = placement?.ads ?? [];
  const title =
    variant === 'business' ? t('discovery.sponsoredBusinesses') : t('discovery.sponsoredGiftCards');
  if (ads.length === 0) {
    return (
      <View style={style}>
        <SectionHeader title={title} />
        <View style={styles.emptyStrip}>
          <Text style={styles.emptyStripText}>No sponsored items</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={style}>
      <SectionHeader title={title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hScrollOuter}
        contentContainerStyle={styles.hScroll}
      >
        {ads.map((ad) => {
          const image = ad.mobile_image_url || ad.image_url;
          const label = labelFor(ad, i18n.language);
          return (
            <Pressable
              key={ad.impression_id}
              onPress={() => void openSponsoredAd(ad)}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${headlineFor(ad, i18n.language)}`}
              style={({ pressed }) => [styles.nativeWrap, pressed && styles.pressed]}
            >
              <Card padded={false} style={styles.nativeCard}>
                <View style={styles.nativeMedia}>
                  {image ? (
                    <Image
                      source={{ uri: image }}
                      style={styles.nativeImage}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View style={styles.nativeFallback}>
                      <Megaphone size={24} color={colors.ink} />
                    </View>
                  )}
                  <View style={styles.pillPosition}>
                    <SponsoredPill label={label} />
                  </View>
                </View>
                <View style={styles.nativeBody}>
                  {ad.vendor_name ? (
                    <Text style={styles.vendor} numberOfLines={1}>
                      {i18n.language === 'ar' && ad.vendor_name_ar ? ad.vendor_name_ar : ad.vendor_name}
                    </Text>
                  ) : null}
                  <Text style={styles.nativeHeadline} numberOfLines={2}>
                    {headlineFor(ad, i18n.language)}
                  </Text>
                  <View style={styles.ctaRow}>
                    <Text style={styles.cta}>{ctaFor(ad, i18n.language, t('discovery.learnMore'))}</Text>
                    <ArrowRight size={14} color={colors.ink} />
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => ({
  carousel: { gap: spacing.sm },
  slide: { backgroundColor: colors.surface },
  pressed: { opacity: 0.92 },
  media: { position: 'relative', backgroundColor: colors.lavenderTint },
  image: { width: '100%' },
  imageFallback: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderTint,
  },
  pillPosition: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  sponsoredPill: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sponsoredPillText: { fontFamily: fonts.bold, fontSize: fontSizes.xs, color: colors.ink },
  copy: { padding: spacing.md, gap: spacing.xs },
  headline: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.lg,
    color: colors.text,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 19,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  cta: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  dotActive: { backgroundColor: colors.ink, width: 20 },
  // Break out of the page gutter so the strip reaches the screen edges, then
  // re-apply the gutter inside the content so cards line up with the page.
  hScrollOuter: { marginHorizontal: -spacing.gutter, marginTop: spacing.sm },
  hScroll: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  emptyStrip: { padding: spacing.md, alignItems: 'center' },
  emptyStripText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  nativeWrap: { width: 240 },
  nativeCard: { overflow: 'hidden' },
  nativeMedia: { position: 'relative', height: 116, backgroundColor: colors.skySoft },
  nativeImage: { width: '100%', height: '100%' },
  nativeFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.skySoft,
  },
  nativeBody: { padding: spacing.sm + 2, gap: 2 },
  vendor: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  nativeHeadline: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
}));
