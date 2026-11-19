import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { giftHref } from '@/src/lib/navigation';
import { MapPin, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile, type IconTileTone } from '@/src/components/IconTile';
import { OfferCard } from '@/src/components/OfferCard';
import { Screen } from '@/src/components/Screen';
import { ShowMore, usePaged } from '@/src/components/ShowMore';
import { SectionHeader } from '@/src/components/SectionHeader';
import { BusinessSkeleton, SkeletonList } from '@/src/components/Skeleton';
import { offerBusinessId, offerTone } from '@/src/lib/catalog';
import { useThemeRefresh } from '@/src/lib/theme';
import {
  getBusiness,
  listOffersForBusiness,
  listVendorLocations,
  peekBusiness,
  peekLocations,
  peekOffersForBusiness,
} from '@/src/lib/data';
import type { AccentTone, BusinessLocation, MarketplaceBusiness, Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

export default function BusinessScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const { id, name: paramName, logo } = useLocalSearchParams<{
    id: string;
    name?: string;
    logo?: string;
  }>();

  // The home feed and the business list already hold this record. Start from
  // that copy (or the name passed in the route) so the title is right on the
  // first frame, then refresh quietly.
  const known = id ? peekBusiness(id) : null;
  const [offers, setOffers] = useState<Offer[]>(() => (id ? peekOffersForBusiness(id) : []));
  const [business, setBusiness] = useState<MarketplaceBusiness | null>(known);
  const [locations, setLocations] = useState<BusinessLocation[]>(() =>
    known ? peekLocations(known.id) : [],
  );
  const [loading, setLoading] = useState(Boolean(id) && !known);
  const [offersLoading, setOffersLoading] = useState(Boolean(id) && offers.length === 0);
  const request = useRef(0);

  const load = useCallback(async () => {
    const token = ++request.current;
    const isActive = () => request.current === token;

    if (!id) return;

    try {
      // Start both requests together. The business one is usually served from
      // memory; the offer query only asks for this business, not the whole
      // marketplace.
      const offersPromise = listOffersForBusiness(id);
      const found = await getBusiness(id);
      if (!isActive()) return;

      setBusiness(found);
      setLoading(false);

      const locationsPromise =
        found?.business_kind === 'vendor'
          ? listVendorLocations(found.id)
          : Promise.resolve<BusinessLocation[]>([]);

      const [offerRows, locationRows] = await Promise.all([offersPromise, locationsPromise]);
      if (!isActive()) return;

      setOffers(offerRows);
      setLocations(locationRows);
    } catch {
      if (!isActive()) return;
      setBusiness((current) => current ?? null);
      setLocations([]);
    } finally {
      if (isActive()) {
        setLoading(false);
        setOffersLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const businessId = business?.id ?? id ?? '';
  const offersMatching = offers.filter((offer) => offerBusinessId(offer) === businessId);
  const page = usePaged(offersMatching, 6);
  const primary = offersMatching[0];
  const tone = primary ? (offerTone(primary) as AccentTone) : 'lavender';
  const isPartner = business?.business_kind === 'partner';
  const name = business?.name ?? paramName ?? t('business.title');
  const location = business?.area ?? business?.city ?? primary?.location ?? null;
  const logoUrl = business?.logo_url ?? logo ?? null;

  return (
    <Screen>
      <FlowHeader
        title={name}
        subtitle={offersMatching.length > 0 ? t('business.giftCards') : undefined}
        onBack={() => router.back()}
        splash
      />

      {loading && !business ? (
        <BusinessSkeleton />
      ) : !business ? (
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="store"
          tone="lavender"
        />
      ) : (
        <>
          {business.banner_url ? (
            <Card tone="surface" padded={false} style={styles.banner}>
              <Image
                source={business.banner_url}
                style={styles.bannerImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={160}
              />
            </Card>
          ) : null}

          <Card tone={tone === 'sky' ? 'sky' : tone}>
            <View style={styles.heroRow}>
              <IconTile
                icon="store"
                imageUrl={logoUrl ?? undefined}
                size={72}
                tone={tone === 'sky' ? 'sky' : (tone as IconTileTone)}
              />
              <View style={styles.heroCopy}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={2}>
                    {business.name}
                  </Text>
                  {isPartner ? <Badge label={t('business.partner')} tone="primary" /> : null}
                </View>
                <View style={styles.metaRow}>
                  <Star size={13} color={colors.gold} />
                  <Text style={styles.meta}>
                    {t('business.rating', { rating: (business.rating ?? 4.8).toFixed(1) })}
                  </Text>
                  {location ? (
                    <>
                      <Text style={styles.dot}>·</Text>
                      <MapPin size={12} color={colors.ink} />
                      <Text style={styles.meta} numberOfLines={1}>
                        {location}
                      </Text>
                    </>
                  ) : null}
                </View>
                <Text style={styles.giftCount}>
                  {business.gift_count === 1
                    ? t('business.oneGift')
                    : t('business.manyGifts', { count: business.gift_count })}
                </Text>
              </View>
            </View>
          </Card>

          {isPartner ? (
            <Card tone="gold" style={styles.partnerNote}>
              <Text style={styles.partnerNoteTitle}>{t('business.partnerGift')}</Text>
              <Text style={styles.partnerNoteBody}>{t('business.partnerGiftBody')}</Text>
            </Card>
          ) : null}

          {business.description ? (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>{t('business.about')}</Text>
              <Text style={styles.body}>{business.description}</Text>
            </Card>
          ) : null}

          <SectionHeader title={t('business.giftCards')} splash />
          {offersLoading && offersMatching.length === 0 ? (
            <SkeletonList rows={2} />
          ) : offersMatching.length === 0 ? (
            <EmptyState
              title={t('home.noOffers')}
              body={t('home.noOffersBody')}
              icon="gift"
              tone="lavender"
            />
          ) : (
            <View style={styles.list}>
              {page.visible.map((offer, index) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  index={index}
                  vendorLink={false}
                  onPress={() => router.push(giftHref(offer) as never)}
                />
              ))}
            </View>
          )}
          {page.hasMore ? <ShowMore expanded={page.expanded} onPress={page.toggle} /> : null}

          {!isPartner && locations.length > 0 ? (
            <>
              <SectionHeader title={t('business.locations')} />
              <View style={styles.list}>
                {locations.map((item) => (
                  <Card key={item.id} style={styles.location}>
                    <View style={styles.locationTop}>
                      <Text style={styles.locationArea}>{item.area}</Text>
                      <Badge label={item.hours} tone="success" />
                    </View>
                    <Text style={styles.locationAddress}>{item.address}</Text>
                    <Text style={styles.locationLink}>{t('business.openMaps')} →</Text>
                  </Card>
                ))}
              </View>
            </>
          ) : null}

          {primary ? (
            <Button
              label={t('gift.buyNow')}
              fullWidth
              onPress={() => router.push(giftHref(primary) as never)}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  loader: { marginTop: spacing.xxl },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroCopy: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  name: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  dot: { color: colors.textMuted, fontSize: fontSizes.xs },
  giftCount: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.textMuted },
  partnerNote: { gap: spacing.xs },
  partnerNoteTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  partnerNoteBody: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 19 },
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.textMuted, lineHeight: 21 },
  list: { gap: spacing.sm },
  location: { gap: spacing.xs },
  locationTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  locationArea: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  locationAddress: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  locationLink: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.tealDark, marginTop: spacing.xs },
  banner: { padding: 0, overflow: 'hidden', height: 150 },
  bannerImage: { width: '100%', height: '100%' },
}));
