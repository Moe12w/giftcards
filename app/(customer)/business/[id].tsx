import React, { useCallback, useEffect, useState } from 'react';
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
import { offerTone } from '@/src/lib/catalog';
import { getPartner, listActiveOffers, listVendorLocations } from '@/src/lib/data';
import type { AccentTone, BusinessLocation, Offer, PartnerBusiness, Vendor } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

type BusinessKind = 'partner' | 'vendor';

type BusinessState = {
  kind: BusinessKind;
  partner?: PartnerBusiness;
  vendor?: Vendor;
};

export default function BusinessScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [business, setBusiness] = useState<BusinessState | null>(null);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [data, partner] = await Promise.all([
        listActiveOffers(),
        getPartner(id),
      ]);
      setOffers(data);
      if (partner) {
        setBusiness({ kind: 'partner', partner });
      } else {
        const vendor = await fetchVendor(id);
        if (vendor) {
          setBusiness({ kind: 'vendor', vendor });
        }
      }
      if (!partner) {
        const rows = await listVendorLocations(id);
        setLocations(rows);
      }
    } catch {
      // fall back to empty state
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const offersMatching = offers.filter(
    (offer) => offer.vendor_id === id || offer.partner_id === id,
  );
  const primary = offersMatching[0];
  const tone = primary ? (offerTone(primary) as AccentTone) : 'lavender';
  const isPartner = business?.kind === 'partner';
  const name = isPartner ? (business?.partner?.name ?? t('business.title')) : (business?.vendor?.name ?? t('business.title'));
  const logoUrl = isPartner ? (business?.partner?.logo_url ?? null) : (business?.vendor?.logo_url ?? null);
  const bannerUrl = isPartner ? (business?.partner?.banner_url ?? null) : (business?.vendor?.banner_url ?? null);
  const description = isPartner ? (business?.partner?.description ?? null) : (business?.vendor?.description ?? null);
  const rating = primary?.rating ?? 4.8;
  const location = !isPartner ? (primary?.location ?? undefined) : undefined;

  return (
    <Screen>
      <FlowHeader title={name} subtitle={primary ? t('business.giftCards') : undefined} onBack={() => router.back()} />

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : !business ? (
        <EmptyState title={t('states.not-found.title')} body={t('states.not-found.body')} icon="store" tone="lavender" />
      ) : (
        <>
          {bannerUrl ? (
            <Card tone="surface" padded={false} style={styles.banner}>
              <Image source={{ uri: bannerUrl }} style={styles.bannerImage} resizeMode="cover" />
            </Card>
          ) : null}

          <Card tone={tone === 'sky' ? 'sky' : tone}>
            <View style={styles.heroRow}>
              <IconTile icon={primary?.icon ?? 'gift'} imageUrl={logoUrl ?? undefined} size={72} tone={tone === 'sky' ? 'sky' : (tone as IconTileTone)} />
              <View style={styles.heroCopy}>
                <Text style={styles.name}>{name}</Text>
                <View style={styles.metaRow}>
                  <Star size={13} color={colors.gold} />
                  <Text style={styles.meta}>{t('business.rating', { rating: rating.toFixed(1) })}</Text>
                  {location ? (
                    <>
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.meta}>{location}</Text>
                    </>
                  ) : null}
                </View>
              </View>
            </View>
          </Card>

          {description ? (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>{t('business.about')}</Text>
              <Text style={styles.body}>{description}</Text>
            </Card>
          ) : null}

          <SectionHeader title={t('business.giftCards')} />
          <View style={styles.list}>
            {offersMatching.map((offer, index) => (
              <OfferCard key={offer.id} offer={offer} index={index} vendorLink={false} onPress={() => router.push(`/(customer)/gift/${offer.id}`)} />
            ))}
          </View>

          {!isPartner && locations.length > 0 ? (
            <>
              <SectionHeader title={t('business.locations')} />
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
            </>
          ) : null}

          <Button label={t('gift.buyNow')} fullWidth onPress={() => primary && router.push(`/(customer)/gift/${primary.id}`)} />
        </>
      )}
    </Screen>
  );
}

async function fetchVendor(id: string): Promise<Vendor | null> {
  const { getSupabase } = await import('@/src/lib/supabase');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const supabase = getSupabase();
  let query = supabase.from('vendors').select('*').eq('status', 'approved');
  query = isUuid ? query.eq('id', id) : query.eq('slug', id);
  const { data } = await query.maybeSingle();
  return (data ?? null) as Vendor | null;
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