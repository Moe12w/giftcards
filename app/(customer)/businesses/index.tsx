import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/src/components/Badge';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { IconTile, type IconTileTone } from '@/src/components/IconTile';
import { Screen } from '@/src/components/Screen';
import { SponsoredStrip } from '@/src/components/SponsoredCarousel';
import { listMarketplaceBusinesses } from '@/src/lib/data';
import type { MarketplaceBusiness } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

const TONES: IconTileTone[] = ['teal', 'gold', 'pink', 'lavender', 'sky'];

export default function BusinessesScreen() {
  const { t, i18n } = useTranslation();
  const [businesses, setBusinesses] = useState<MarketplaceBusiness[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBusinesses(await listMarketplaceBusinesses());
    } catch {
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rtl = i18n.language === 'ar';
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <Screen>
      <FlowHeader title={t('discovery.allBusinesses')} onBack={() => router.back()} />

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      ) : businesses.length === 0 ? (
        <EmptyState
          title={t('home.noOffers')}
          body={t('home.noOffersBody')}
          icon="store"
          tone="lavender"
        />
      ) : (
        <>
          <View style={styles.list}>
            {businesses.map((business, index) => {
            const tone = TONES[index % TONES.length];
            const location = business.area ?? business.city;
            const isPartner = business.business_kind === 'partner';
            return (
              <Pressable
                key={business.id}
                onPress={() => router.push(`/(customer)/business/${business.id}`)}
                accessibilityRole="button"
                accessibilityLabel={business.name}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Card>
                  <View style={styles.row}>
                    <IconTile
                      icon={isPartner ? 'creditCard' : 'store'}
                      imageUrl={business.logo_url ?? undefined}
                      size={60}
                      tone={tone}
                    />
                    <View style={styles.body}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>
                          {business.name}
                        </Text>
                        {isPartner ? <Badge label={t('business.partner')} tone="primary" /> : null}
                      </View>
                      <View style={styles.metaRow}>
                        <Star size={12} color={colors.gold} />
                        <Text style={styles.meta}>{(business.rating ?? 4.8).toFixed(1)}</Text>
                        {location ? (
                          <>
                            <Text style={styles.dot}>·</Text>
                            <Text style={styles.meta} numberOfLines={1}>
                              {location}
                            </Text>
                          </>
                        ) : null}
                      </View>
                      <Text style={styles.gifts}>
                        {business.gift_count === 1
                          ? t('business.oneGift')
                          : t('business.manyGifts', { count: business.gift_count })}
                      </Text>
                    </View>
                    <View style={styles.chevron}>
                      <Arrow size={16} color={colors.ink} />
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
        <SponsoredStrip placementKey="marketplace_sponsored_business" variant="business" limit={3} />
      </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  list: { gap: spacing.sm },
  pressed: { opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  name: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
    flexShrink: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  meta: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  dot: { color: colors.textMuted, fontSize: fontSizes.xs },
  gifts: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.textMuted },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tealTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
