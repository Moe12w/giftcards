import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile, type IconTileTone } from '@/src/components/IconTile';
import { OfferCard } from '@/src/components/OfferCard';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { offerIcon, offerTitle, offerTone } from '@/src/lib/catalog';
import { listActiveOffers } from '@/src/lib/data';
import { MOCK_LOCATIONS } from '@/src/lib/mock-data';
import type { AccentTone, Offer } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

export default function BusinessScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listActiveOffers()
      .then((data) => active && setOffers(data))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const businessOffers = offers.filter((offer) => offer.vendor_id === id);
  const primary = businessOffers[0];
  const locations = MOCK_LOCATIONS.filter((location) => location.vendorId === id);
  const tone = primary ? (offerTone(primary) as AccentTone) : 'lavender';

  return (
    <Screen>
      <FlowHeader
        title={primary?.vendor?.name ?? t('business.title')}
        subtitle={primary ? t('business.giftCards') : undefined}
        onBack={() => router.back()}
      />

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : !primary ? (
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="store"
          tone="lavender"
        />
      ) : (
        <>
          {primary ? (
            <Card tone="surface" padded={false} style={styles.banner}>
              <Image
                source={{
                  uri:
                    primary.vendor?.banner_url ??
                    `https://placehold.co/900x300/png?text=${encodeURIComponent(primary.vendor?.name ?? 'Giftly')}`,
                }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            </Card>
          ) : null}

          <Card tone={tone === 'sky' ? 'sky' : tone}>
            <View style={styles.heroRow}>
              <IconTile
                icon={offerIcon(primary)}
                imageUrl={primary.vendor?.logo_url ?? undefined}
                size={72}
                tone={tone === 'sky' ? 'sky' : (tone as IconTileTone)}
              />
              <View style={styles.heroCopy}>
                <Text style={styles.name}>{primary.vendor?.name ?? offerTitle(primary, i18n.language)}</Text>
                <View style={styles.metaRow}>
                  <Star size={13} color={colors.gold} />
                  <Text style={styles.meta}>{t('business.rating', { rating: (primary.rating ?? 4.8).toFixed(1) })}</Text>
                  {primary.location ? (
                    <>
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.meta}>{primary.location}</Text>
                    </>
                  ) : null}
                </View>
              </View>
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{t('business.about')}</Text>
            <Text style={styles.body}>{primary.description}</Text>
          </Card>

          <SectionHeader title={t('business.giftCards')} />
          <View style={styles.list}>
            {businessOffers.map((offer, index) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                index={index}
                onPress={() => router.push(`/(customer)/gift/${offer.id}`)}
              />
            ))}
          </View>

          <SectionHeader title={t('business.locations')} />
          {locations.length === 0 ? (
            <Text style={styles.body}>{t('business.noLocations')}</Text>
          ) : (
            <View style={styles.list}>
              {locations.map((location) => (
                <Card key={location.id} style={styles.location}>
                  <View style={styles.locationTop}>
                    <Text style={styles.locationArea}>{location.area}</Text>
                    <Badge label={location.hours} tone="success" />
                  </View>
                  <Text style={styles.locationAddress}>{location.address}</Text>
                  <Text style={styles.locationLink}>{t('business.openMaps')} →</Text>
                </Card>
              ))}
            </View>
          )}

          <Button label={t('gift.buyNow')} fullWidth onPress={() => router.push(`/(customer)/gift/${primary.id}`)} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroCopy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  dot: { color: colors.textMuted, fontSize: fontSizes.xs },
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
});
